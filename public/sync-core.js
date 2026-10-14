// One revisioned document per account. Never silently overwrite a newer revision.
export class SyncConflict extends Error {
  constructor(remote) { super('ข้อมูลบนอีกเครื่องเปลี่ยนแล้ว กรุณาเลือกข้อมูลที่ต้องการเก็บ'); this.remote = remote; }
}
export class SyncSession {
  constructor({api, cache, validate, changed = () => {}, uuid = () => crypto.randomUUID()}) {
    Object.assign(this, {api, cache, validate, changed, uuid});
    this.record = null; this.busy = false; this.conflict = null;
  }
  store(record) {
    this.cache.write(record); // Durable local save must succeed before acknowledging.
    this.record = record;
    this.changed(record);
  }
  async open() {
    const remote = await this.api.read();
    const cached = this.cache.read();
    if (cached?.dirty) {
      this.validate(cached.data);
      this.record = cached;
      if (remote.operationId === cached.operationId) {
        this.store({...cached, revision:remote.revision, dirty:false});
      } else if (remote.revision !== cached.revision) {
        this.conflict = remote;
      }
    } else {
      this.store({revision:remote.revision, data:remote.data ? this.validate(remote.data) : null, dirty:false, operationId:null});
    }
    return this.record;
  }
  edit(data) {
    if (!this.record) throw new Error('ยังไม่พร้อมบันทึกข้อมูล');
    this.store({...this.record, data:this.validate(structuredClone(data)), dirty:true, operationId:this.uuid()});
  }
  async sync({allowPull=true} = {}) {
    if (this.busy || this.conflict || !this.record) return;
    this.busy = true;
    try {
      if (this.record.dirty) {
        const sent = structuredClone(this.record);
        let remote;
        try { remote = await this.api.write(sent); }
        catch (error) {
          if (error instanceof SyncConflict) { this.conflict = error.remote; }
          throw error;
        }
        // A second local edit may have happened while the request was in flight.
        if (this.record.operationId === sent.operationId) {
          this.store({...this.record, revision:remote.revision, dirty:false});
        } else {
          this.store({...this.record, revision:remote.revision});
        }
      } else if (allowPull) {
        const before = this.record;
        const remote = await this.api.read();
        if (this.record !== before) return; // Do not replace a newly edited form's data.
        if (remote.revision !== before.revision) {
          this.store({revision:remote.revision, data:remote.data ? this.validate(remote.data) : null, dirty:false, operationId:remote.operationId});
        }
      }
    } finally { this.busy = false; }
  }
  useRemote() {
    if (!this.conflict) return;
    const r=this.conflict;
    this.store({revision:r.revision, data:this.validate(r.data), dirty:false, operationId:r.operationId});
    this.conflict=null;
  }
  useLocal() {
    if (!this.conflict) return;
    this.store({...this.record, revision:this.conflict.revision, dirty:true, operationId:this.uuid()});
    this.conflict=null;
  }
}

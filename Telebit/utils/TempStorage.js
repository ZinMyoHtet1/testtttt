class TempStorage {
  constructor() {
    if (!TempStorage.instance) {
      this.storage = new Map();
      TempStorage.instance = this;
    }
    return TempStorage.instance;
  }

  getStorage() {
    return this.storage;
  }

  set(key, value) {
    this.storage.set(key, value);
  }

  get(key) {
    return this.storage.get(key);
  }

  delete(key) {
    this.storage.delete(key);
  }
}

const instance = new TempStorage();
Object.freeze(instance); // optional: to make it immutable

module.exports = instance;

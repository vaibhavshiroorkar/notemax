// Folder handles and what was last written to them, per workspace. A folder
// handle can only be kept in IndexedDB, not in localStorage like other settings.

const DB = "notemax-markdown-files";
type Shelf = "folders" | "written";

let opened: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("folders");
      request.result.createObjectStore("written");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

async function run<T>(shelf: Shelf, mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const tx = (await db()).transaction(shelf, mode);
  const request = work(tx.objectStore(shelf));
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(request.result);
    tx.onerror = () => reject(tx.error);
  });
}

export const read = <T>(shelf: Shelf, key: string) => run<T | undefined>(shelf, "readonly", (store) => store.get(key));
export const write = (shelf: Shelf, key: string, value: unknown) => run(shelf, "readwrite", (store) => store.put(value, key));
export const forget = (shelf: Shelf, key: string) => run(shelf, "readwrite", (store) => store.delete(key));

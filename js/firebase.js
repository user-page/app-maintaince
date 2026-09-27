// Nơi DUY NHẤT nạp thư viện Firebase. Nạp bằng import() động (không phải import tĩnh ở đầu
// file) để nếu mạng chặn CDN của Google thì chỉ phần lưu trữ hỏng — trang vẫn hiện ra và
// vẫn xem được bằng bản chụp tĩnh trong data/snapshot.json.
import { FIREBASE_CONFIG, FIREBASE_VERSION } from './config.js';

const BASE = 'https://www.gstatic.com/firebasejs/' + FIREBASE_VERSION + '/';

let mods = null;   // { app, db, auth, fs, fbAuth }

export function getMods(){ return mods; }

export async function initFirebase(){
  if(mods) return mods;

  const [appMod, fs, fbAuth] = await Promise.all([
    import(BASE + 'firebase-app.js'),
    import(BASE + 'firebase-firestore.js'),
    import(BASE + 'firebase-auth.js')
  ]);

  const app  = appMod.initializeApp(FIREBASE_CONFIG);
  const db   = fs.getFirestore(app);
  const auth = fbAuth.getAuth(app);

  mods = { app: app, db: db, auth: auth, fs: fs, fbAuth: fbAuth };
  return mods;
}

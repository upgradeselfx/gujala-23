import { NextResponse } from 'next/server';
import admin from 'firebase-admin';

// Inisialisasi Firebase Admin SDK (hanya sekali)
if (!admin.apps.length) {
  const serviceAccount = {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  };
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export async function POST(request: Request) {
  try {
    const { email, password, nama, noTel, alamat } = await request.json();

    // Buat user di Firebase Auth pake Admin SDK (TIDAK auto-login di client)
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: nama,
    });

    // Simpan data tambahan ke Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      nama,
      email,
      noTel,
      alamat,
      role: 'anggota',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
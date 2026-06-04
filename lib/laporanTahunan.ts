// lib/laporanTahunan.ts
import { db } from '@/app/firebase/client';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

export type LaporanTahunan = {
  tahun: number;
  totalAnggota: number;
  totalSimpanan: {
    totalSetor: number;
    totalTarik: number;
    saldoAkhir: number;
  };
  totalPinjaman: {
    totalDisetujui: number;
    totalDibayar: number;
    totalSisa: number;
    jumlahPinjamanAktif: number;
    jumlahPinjamanLunas: number;
    jumlahPinjamanDitolak: number;
  };
  totalCash: {
    target: number;
    terkumpul: number;
    persentase: number;
  };
  totalArisan: {
    totalSesi: number;
    totalTerkumpul: number;
    daftarPemenang: { periode: string; pemenang: string; potongan: number }[];
  };
  rekapBulanan: {
    bulan: string;
    setorSimpanan: number;
    tarikSimpanan: number;
    pinjamanBaru: number;
    cashTerkumpul: number;
  }[];
};

export async function generateLaporanTahunan(tahun: number): Promise<LaporanTahunan> {
  // 1. Total Anggota
  const anggotaSnap = await getDocs(collection(db, 'users'));
  const totalAnggota = anggotaSnap.size;

  // 2. Simpanan (dari transaksi simpanan)
  const transaksiSimpananSnap = await getDocs(collection(db, 'transaksi_simpanan'));
  let totalSetor = 0;
  let totalTarik = 0;
  transaksiSimpananSnap.forEach(doc => {
    const data = doc.data();
    if (data.jenis === 'setor') totalSetor += data.jumlah;
    if (data.jenis === 'tarik') totalTarik += data.jumlah;
  });
  const saldoAkhir = totalSetor - totalTarik;

  // 3. Pinjaman
  const pinjamanSnap = await getDocs(collection(db, 'pinjaman'));
  let totalPinjamanDisetujui = 0;
  let totalPinjamanDibayar = 0;
  let totalSisa = 0;
  let aktif = 0, lunas = 0, ditolak = 0;
  
  pinjamanSnap.forEach(doc => {
    const data = doc.data();
    if (data.status === 'aktif' || data.status === 'lunas') {
      totalPinjamanDisetujui += data.jumlah;
      totalSisa += data.sisa || 0;
    }
    if (data.status === 'aktif') aktif++;
    if (data.status === 'lunas') lunas++;
    if (data.status === 'ditolak') ditolak++;
  });
  
  // Perkiraan total dibayar
  totalPinjamanDibayar = totalPinjamanDisetujui - totalSisa;

  // 4. Cash Bulanan (untuk tahun tertentu)
  const cashSnap = await getDocs(query(
    collection(db, 'cash_bulanan'),
    where('tahun', '==', tahun)
  ));
  let totalCashTerkumpul = 0;
  let totalCashTarget = 0;
  cashSnap.forEach(doc => {
    const data = doc.data();
    totalCashTarget += data.jumlah;
    if (data.statusBayar === 'lunas') {
      totalCashTerkumpul += data.jumlah;
    }
  });
  const persentaseCash = totalCashTarget > 0 ? (totalCashTerkumpul / totalCashTarget) * 100 : 0;

  // 5. Arisan
  const arisanSnap = await getDocs(collection(db, 'arisan_sesi'));
  let totalArisanTerkumpul = 0;
  const daftarPemenang: { periode: string; pemenang: string; potongan: number }[] = [];
  arisanSnap.forEach(doc => {
    const data = doc.data();
    totalArisanTerkumpul += data.jumlahPotongan || 0;
    daftarPemenang.push({
      periode: data.periode,
      pemenang: data.pemenangNama,
      potongan: data.jumlahPotongan || 0,
    });
  });

  // 6. Rekap Bulanan
  const bulanNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const rekapBulanan = [];
  
  for (let i = 0; i < 12; i++) {
    const bulan = i + 1;
    // Simpanan bulan ini
    let setorBulan = 0, tarikBulan = 0;
    transaksiSimpananSnap.forEach(doc => {
      const data = doc.data();
      const timestamp = data.timestamp?.toDate();
      if (timestamp && timestamp.getFullYear() === tahun && timestamp.getMonth() + 1 === bulan) {
        if (data.jenis === 'setor') setorBulan += data.jumlah;
        if (data.jenis === 'tarik') tarikBulan += data.jumlah;
      }
    });
    
    // Pinjaman baru bulan ini
    let pinjamanBaru = 0;
    pinjamanSnap.forEach(doc => {
      const data = doc.data();
      const timestamp = data.diajukanPada?.toDate();
      if (timestamp && timestamp.getFullYear() === tahun && timestamp.getMonth() + 1 === bulan) {
        pinjamanBaru += data.jumlah;
      }
    });
    
    // Cash terkumpul bulan ini
    let cashBulan = 0;
    cashSnap.forEach(doc => {
      const data = doc.data();
      if (data.bulan === bulan && data.statusBayar === 'lunas') {
        cashBulan += data.jumlah;
      }
    });
    
    rekapBulanan.push({
      bulan: bulanNames[i],
      setorSimpanan: setorBulan,
      tarikSimpanan: tarikBulan,
      pinjamanBaru: pinjamanBaru,
      cashTerkumpul: cashBulan,
    });
  }

  return {
    tahun,
    totalAnggota,
    totalSimpanan: {
      totalSetor,
      totalTarik,
      saldoAkhir,
    },
    totalPinjaman: {
      totalDisetujui: totalPinjamanDisetujui,
      totalDibayar: totalPinjamanDibayar,
      totalSisa,
      jumlahPinjamanAktif: aktif,
      jumlahPinjamanLunas: lunas,
      jumlahPinjamanDitolak: ditolak,
    },
    totalCash: {
      target: totalCashTarget,
      terkumpul: totalCashTerkumpul,
      persentase: persentaseCash,
    },
    totalArisan: {
      totalSesi: arisanSnap.size,
      totalTerkumpul: totalArisanTerkumpul,
      daftarPemenang,
    },
    rekapBulanan,
  };
}
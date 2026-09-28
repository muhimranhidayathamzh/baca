/**
 * Fitur animasi Framer Motion yang dimuat terpisah lewat LazyMotion (lihat
 * AppShell). `domMax` dipakai — bukan `domAnimation` yang lebih kecil — karena
 * app memakai drag (swipe-down reader) dan layout animation (indikator bottom
 * nav, pill mode toggle, kartu feed).
 *
 * Dimuat sebagai chunk asinkron, jadi tidak ikut membebani boot awal halaman:
 * teks dan kartu sudah tampil sebelum mesin animasinya selesai diunduh.
 */
import { domMax } from "framer-motion";

export default domMax;

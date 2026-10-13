import type {Metadata,Viewport} from 'next';
import './globals.css';
export const metadata:Metadata={title:'LingoStep — Học từng chút, tiến thật xa',description:'Học tiếng Anh từng bước cho người Việt. Bài học nhỏ, luyện nghe đọc nói viết, ôn tập cách quãng từ A0 đến C2.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'LingoStep',statusBarStyle:'default'},icons:{icon:'/icons/icon-192.png',apple:'/icons/icon-192.png'}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#f36542'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>;}

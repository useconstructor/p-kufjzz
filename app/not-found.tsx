import Link from 'next/link';
import { BrandPage } from '@/components/brand';
export default function NotFound() { return <BrandPage title="Por aquí no hay una página." subtitle="Vuelve a la mesa para explorar los talleres o consultar tus reservas."><Link className="brand-button" href="/">Volver al inicio</Link></BrandPage>; }

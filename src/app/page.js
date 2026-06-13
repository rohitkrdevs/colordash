'use client';
import dynamic from 'next/dynamic';

const ColorDashGame = dynamic(() => import('../components/ColorDashGame'), {
  ssr: false,
});

export default function Home() {
  return (
    <main>
      <ColorDashGame />
    </main>
  );
}

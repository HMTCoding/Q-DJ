import Link from "next/link";

export default function Footer() {
  return (
    <footer className="py-8 text-center text-gray-500 text-sm">
      <Link href="https://q-dj.hmt-network.de">Q-DJ</Link> © 2025 by
      <Link href="https://coding.hmt-network.de"> HMT Coding</Link> is licensed
      under{" "}
      <Link href="https://creativecommons.org/licenses/by-nc-sa/4.0/">
        CC BY-NC-SA 4.0
      </Link>
    </footer>
  );
}

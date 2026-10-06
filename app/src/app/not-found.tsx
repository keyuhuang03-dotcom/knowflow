import Link from "next/link";
export default function NotFound() { return <div className="wb-empty"><h1>这条学习记录不存在</h1><p>它可能已被移除，请回到知识库重新查找。</p><Link className="btn btn-primary" href="/knowledge">返回知识库</Link></div>; }

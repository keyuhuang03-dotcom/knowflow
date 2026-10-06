"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <section className="wb-panel wb-stack"><h1>暂时无法读取学习数据</h1><p>请确认数据库已启动并完成迁移，然后重试。浏览器中暂存的错题草稿会保留。</p><button className="btn btn-primary" onClick={reset}>重新加载</button></section>;
}

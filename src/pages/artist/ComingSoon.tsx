export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <div className="artist-main">
      <div className="stack" style={{ paddingTop: 'calc(28px + env(safe-area-inset-top, 0px))' }}>
        <h1 className="display" style={{ fontSize: 44 }}>{title}</h1>
        <div className="empty">{text}</div>
      </div>
    </div>
  );
}

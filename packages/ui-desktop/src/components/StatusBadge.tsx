interface Props {
  connected: boolean;
}

export function StatusBadge({ connected }: Props) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: connected ? '#22c55e' : '#ef4444' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
      {connected ? 'Connected' : 'Disconnected'}
    </span>
  );
}

const flow = [
  {
    title: 'Input',
    detail: 'Laptop microphone captures teacher speech and the camera observes hand position.',
  },
  {
    title: 'AI Processing',
    detail: 'Speech is converted into commands, gestures are classified, and the best classroom visual is selected.',
  },
  {
    title: 'Smart Board Output',
    detail: 'The 3D teaching board updates automatically on the projector without touching mouse or keyboard.',
  },
];

export function SystemFlow() {
  return (
    <section className="system-flow">
      {flow.map((item, index) => (
        <div className="flow-card" key={item.title}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <h3>{item.title}</h3>
          <p>{item.detail}</p>
        </div>
      ))}
    </section>
  );
}

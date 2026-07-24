export function Footer() {
  return (
    <footer className="footer-note">
      <strong>Deployment note:</strong> Camera and microphone permissions require HTTPS in production or localhost in development. The app includes local command fallback for browsers where speech recognition is restricted.
    </footer>
  );
}

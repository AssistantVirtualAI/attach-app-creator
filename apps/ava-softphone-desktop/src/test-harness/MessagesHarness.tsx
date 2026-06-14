import MessagesView from '../components/console/MessagesView';
import { theme } from '../lib/theme';

const { colors: c } = theme;

export default function MessagesHarness() {
  return (
    <div style={{ height: '100vh', background: c.bgGradient, color: c.textIce }}>
      <MessagesView />
    </div>
  );
}

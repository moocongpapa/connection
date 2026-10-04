import dotenv from 'dotenv';
import { createApplication } from './app.js';

dotenv.config({ path: ['.env.local', '.env'] });
const application = createApplication();
export default application.httpServer;
if (!process.env.VERCEL) {
  application.ready.then(() => {
    application.httpServer.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => {
      console.log('Connection server listening on port ' + (process.env.PORT ?? 3001));
    });
  }).catch(() => { process.exitCode = 1; });
}

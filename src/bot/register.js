import { Scenes } from 'telegraf';

import registerStart from './start.js';
import registerMiniappData from './miniappData.js';
import registerConfirmDetails from './confirmDetails.js';
import { detailsWizard } from './detailsWizard.js';
import { fieldUpdate } from './fieldUpdate.js';
import registerAdmin from './admin.js';
import registerFallback from './fallback.js';

export function registerAllHandlers(bot) {
  // Wizard + scene stage
  const stage = new Scenes.Stage([detailsWizard, fieldUpdate]);
  bot.use(stage.middleware());

  registerStart(bot);
  registerMiniappData(bot);
  registerConfirmDetails(bot);
  registerAdmin(bot);

  // MUST stay last — its catch-all `bot.on('message')` replies to anything the
  // handlers above didn't claim, so a user never gets silence.
  registerFallback(bot);
}

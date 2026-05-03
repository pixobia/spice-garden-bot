import { Scenes } from 'telegraf';

import registerStart from './start.js';
import registerMiniappData from './miniappData.js';
import registerConfirmDetails from './confirmDetails.js';
import { detailsWizard } from './detailsWizard.js';
import registerAdmin from './admin.js';

export function registerAllHandlers(bot) {
  // Wizard scenes
  const stage = new Scenes.Stage([detailsWizard]);
  bot.use(stage.middleware());

  registerStart(bot);
  registerMiniappData(bot);
  registerConfirmDetails(bot);
  registerAdmin(bot);
}

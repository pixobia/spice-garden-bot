import { Scenes } from 'telegraf';

import registerStart from './start.js';
import registerViewMenu from './viewMenu.js';
import registerMiniappData from './miniappData.js';
import registerConfirmDetails from './confirmDetails.js';
import { detailsWizard } from './detailsWizard.js';
import registerPayment from './payment.js';
import registerAdmin from './admin.js';

export function registerAllHandlers(bot) {
  // Wizard scenes
  const stage = new Scenes.Stage([detailsWizard]);
  bot.use(stage.middleware());

  registerStart(bot);
  registerViewMenu(bot);
  registerMiniappData(bot);
  registerConfirmDetails(bot);
  registerPayment(bot);
  registerAdmin(bot);
}

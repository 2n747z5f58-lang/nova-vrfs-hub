import type { NovaCommand } from '../lib/command.js';
import { addteam } from './addteam.js';
import { makedivision } from './makedivision.js';
import { enddivision, startdivision } from './division-lifecycle.js';
import { submitresult } from './submitresult.js';
import { sign } from './sign.js';
import { loan } from './loan.js';
import { recall } from './recall.js';
import { transfer } from './transfer.js';
import { budget } from './budget.js';
import { release } from './release.js';
import { setup } from './setup.js';

export const commands: NovaCommand[] = [
  submitresult,
  addteam,
  makedivision,
  startdivision,
  enddivision,
  sign,
  loan,
  recall,
  transfer,
  budget,
  release,
  setup,
];

export const commandMap = new Map(commands.map((c) => [c.data.name, c]));

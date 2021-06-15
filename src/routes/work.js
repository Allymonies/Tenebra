/**
 * Created by Drew Lemmy, 2016-2021
 *
 * This file is part of Tenebra.
 *
 * Tenebra is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Tenebra is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tenebra. If not, see <http://www.gnu.org/licenses/>.
 *
 * For more project information, see <https://github.com/allymonies/tenebra>.
 */

const tenebra = require("./../tenebra.js");
const blocks = require("./../blocks.js");
const staking = require("./../staking.js");
const names = require("./../names.js");

module.exports = function(app) {
  app.get("/", async function(req, res, next) {
    if (typeof req.query.getwork !== "undefined") {
      return res.send((await tenebra.getWork()).toString());
    }

    next();
  });

  /**
   * @api {get} /work Get the current work
   * @apiName GetWork
   * @apiGroup MiscellaneousGroup
   * @apiVersion 2.0.5
   *
   * @apiSuccess {Number} work The current Tenebra work (difficulty)
   *
   * @apiSuccessExample {json} Success
   * {
   *     "ok": true,
   *     "work": 18750
     * }
   */
  app.get("/work", async function(req, res) {
    res.json({
      ok: true,
      work: await tenebra.getWork()
    });
  });

  /**
   * @api {get} /work/day Get the work over the past 24 hours
   * @apiName GetWorkDay
   * @apiGroup MiscellaneousGroup
   * @apiVersion 2.0.5
   *
   * @apiSuccess {Number[]} work The work every minute for the past 24 hours, starting with 24 hours ago.
   *
   * @apiSuccessExample {json} Success
   * {
   *     "ok": true,
   *     "work": [18750, 19250, ...]
     * }
   */
  app.get("/work/day", async function(req, res) {
    res.json({
      ok: true,
      work: await tenebra.getWorkOverTime()
    });
  });

  /**
   * @api {get} /work/detailed Get detailed work and block value information
   * @apiName GetWorkDetailed
   * @apiGroup MiscellaneousGroup
   * @apiVersion 2.6.0
   *
   * @apiSuccess {Number} work The current Tenebra work (difficulty)
   * @apiSuccess {Number} unpaid The current number of unpaid names
   * 
   * @apiSuccess {Number} base_value The base block value
   * @apiSuccess {Number} block_value The current block value (base + unpaid)
   * 
   * @apiSuccess {Object} decrease Information about the next block value
   *   decrease
   * @apiSuccess {Number} decrease[value] How much Tenebra the block value will
   *   decrease by when the next name(s) expire
   * @apiSuccess {Number} decrease[blocks] How many blocks before the next block
   *   value decrease
   * @apiSuccess {Number} decrease[reset] How many blocks before the block value
   *   will completely reset to the base value
   * 
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "work": 92861,
   *   "unpaid": 3,
   *   "base_value": 1,
   *   "block_value": 4,
   *   "decrease": {
   *     "value": 2,
   *     "blocks": 496,
   *     "reset": 500
   *   }
   * }
   */
  app.get("/work/detailed", async function (req, res) {
    const lastBlock = await blocks.getLastBlock();
    const unpaidNames = await names.getUnpaidNameCount();
    const unpaidPenalties = await staking.getUnpaidPenaltyCount();
    const baseValue = blocks.getBaseBlockValue(lastBlock.id);

    const detailedUnpaid = await names.getDetailedUnpaid();
    const nextUnpaid = detailedUnpaid.find(u => u.unpaid > 0);
    const mostUnpaid = [...(detailedUnpaid.filter(u => u.unpaid > 0))];
    mostUnpaid.sort((a, b) => b.unpaid - a.unpaid);

    const detailedUnpaidPenalties = await staking.getDetailedUnpaidPenalties();
    const nextUnpaidPenalty = detailedUnpaidPenalties.find(u => u.penalty > 0);
    const mostUnpaidPenalty = [...(detailedUnpaidPenalties.filter(u => u.penalty > 0))];
    mostUnpaidPenalty.sort((a, b) => b.penalty - a.penalty);

    res.json({
      ok: true,

      work: await tenebra.getWork(),
      unpaid: unpaidNames,
      unpaidPenalties: unpaidPenalties,

      base_value: baseValue,
      block_value: baseValue + unpaidNames + unpaidPenalties,

      decrease: {
        value: nextUnpaid ? nextUnpaid.count : 0,
        blocks: nextUnpaid ? nextUnpaid.unpaid : 0,
        reset: mostUnpaid && mostUnpaid.length > 0 ? mostUnpaid[0].unpaid : 0
      },

      decreasePenalty: {
        value: nextUnpaidPenalty ? nextUnpaidPenalty.count : 0,
        blocks: nextUnpaidPenalty ? nextUnpaidPenalty.penalty : 0,
        reset: mostUnpaidPenalty && mostUnpaidPenalty.length > 0 ? mostUnpaidPenalty[0].penalty : 0
      }
    });
  });

  return app;
};

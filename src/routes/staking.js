/**
 * Created by Allymonies, 2021
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

const stakingController = require("./../controllers/staking.js");
const utils             = require("./../utils.js");
const moment            = require("moment");

module.exports = function(app) {
  /**
	 * @apiDefine StakingGroup Staking
	 *
	 * All Staking related endpoints.
	 */

  /**
	 * @apiDefine Stake
	 *
	 * @apiSuccess {Object} stake
	 * @apiSuccess {String} stake.owner The owner of this stake.
	 * @apiSuccess {Number} stake.amount The amount of Tenebra being staked.
     * @apiSuccess {Boolean} stake.active Whether the stake is active, i.e. has not failed to mint it's last assigned block.
	 */
     
  /**
	 * @apiDefine Stakes
	 *
	 * @apiSuccess {Object[]} stakes
	 * @apiSuccess {String} stakes.owner The owner of this stake.
	 * @apiSuccess {Number} stakes.amount The amount of Tenebra being staked.
  * @apiSuccess {Boolean} stakes.active Whether the stake is active, i.e. has not failed to mint it's last assigned block.
	 */

  /**
	 * @apiDefine Penalty
	 *
	 * @apiSuccess {Object} penalty
	 * @apiSuccess {String} penalty.address The address responsible for the penalty.
	 * @apiSuccess {Number} penalty.amount The amount of penalty remaining to be distributed.
	 */

  /**
	 * @apiDefine Penalties
	 *
	 * @apiSuccess {Object[]} penalties
	 * @apiSuccess {String} penalties.address The address responsible for the penalty.
	 * @apiSuccess {Number} penalties.amount The amount of penalty remaining to be distributed.
	 */

  /**
	 * @api {get} /staking List all stakes
	 * @apiName GetStakes
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the results.
	 * @apiParam (QueryParameter) {Boolean} [excludeInactive] If specified, inactive stakes will be excluded.
	 *
	 * @apiSuccess {Number} count The count of results.
	 * @apiSuccess {Number} total The total amount of stakes.
	 * @apiUse Stakes
	 *
	 * @apiSuccessExample {json} Success
	 * {
     *     "ok": true,
     *     "count": 50,
     *     "total": 100,
     *     "stakes": [
     *         {
     *             "owner": "tttttttttt",
     *             "amount": 2500,
     *             "active": true
     *         },
     *         {
     *             "owner": "tltutbkiyf",
     *             "amount": 100,
     *             "active": false
     *         },
	 *  	   ...
	 */
  app.get("/staking", function(req, res) {
    stakingController.getStakes(req.query.limit, req.query.offset, false, typeof req.query.excludeInactive === "undefined").then(function(stakes) {
      const out = [];

      stakes.rows.forEach(function (stake) {
        out.push(stakingController.stakeToJSON(stake));
      });

      res.json({
        ok: true,
        count: out.length,
        total: stakes.count,
        stakes: out
      });
    }).catch(function(error) {
      utils.sendErrorToRes(req, res, error);
    });
  });

  /**
	 * @api {get} /staking/validator Get the current validator
	 * @apiName GetValidator
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiSuccess {String} validator The current validator.
	 *
	 * @apiSuccessExample {json} Success
	 * {
	 *     "ok": true,
	 *     "validator": "tttttttttt"
	 * }
	 */
     app.get("/staking/validator", async function(req, res) {

      try {
        const validator = await stakingController.getValidator();
  
        res.json({
          ok: true,
          validator: validator
        })
      } catch (err) {
        utils.sendErrorToRes(req, res, err);
      }
    });

  /**
	 * @api {get} /staking/bonus Get the staking penalty bonus
	 * @apiName GetPenaltyBonus
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiSuccess {Number} penalty_bonus The staking penalty bonus.
	 *
	 * @apiSuccessExample {json} Success
	 * {
	 *     "ok": true,
	 *     "penalty_bonus": 1
	 * }
	 */
     app.get("/staking/bonus", async function(req, res) {

      try {
        const penaltyBonus = await stakingController.getPenalty();
  
        res.json({
          ok: true,
          penalty_bonus: penaltyBonus
        })
      } catch (err) {
        utils.sendErrorToRes(req, res, err);
      }
    });

  /**
	 * @api {get} /staking/penalties List active staking penalties
	 * @apiName GetPenalties
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the results.
	 *
	 * @apiSuccess {Number} count The count of results.
	 * @apiSuccess {Number} total The total amount of penalties.
	 * @apiUse Penalties
	 *
	 * @apiSuccessExample {json} Success
	 * {
     *     "ok": true,
     *     "count": 50,
     *     "total": 100,
     *     "penalties": [
     *         {
     *             "address": "tttttttttt",
     *             "amount": 100
     *         },
     *         {
     *             "address": "tltutbkiyf",
     *             "amount": 1
     *         },
	 *  	   ...
	 */
   app.get("/staking/penalties", function(req, res) {
    stakingController.getPenalties(req.query.limit, req.query.offset, false).then(function(penalties) {
      const out = [];

      penalties.rows.forEach(function (penalty) {
        out.push(stakingController.penaltyToJSON(penalty));
      });

      res.json({
        ok: true,
        count: out.length,
        total: penalties.count,
        penalties: out
      });
    }).catch(function(error) {
      utils.sendErrorToRes(req, res, error);
    });
  });


  /**
	 * @api {get} /staking/:address Get an address' stake
	 * @apiName GetStake
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiParam (URLParameter) {String} address The address.
	 *
	 * @apiUse Stake
	 *
	 * @apiSuccessExample {json} Success
	 * {
	 *     "ok": true,
	 *     "stake": {
	 *         "owner": "tttttttttt",
   *          "amount": 2500,
   *          "active": true
	 *     }
	 * }
	 *
	 * @apiErrorExample {json} Address Not Found
	 * {
	 *     "ok": false,
	 *     "error": "address_not_found"
	 * }
	 *
	 * @apiErrorExample {json} Invalid Address
	 * {
	 *     "ok": false,
	 *     "error": "invalid_parameter",
	 *     "parameter": "address"
	 * }
	 */
   app.get("/staking/:address", async function(req, res) {

    try {
      const stake = await stakingController.getStake(
        req.params.address);

      res.json({
        ok: true,
        stake: stakingController.stakeToJSON(stake)
      });
    } catch (err) {
      utils.sendErrorToRes(req, res, err);
    }
  });

    /**
	 * @api {post} /staking/ Deposit a stake
	 * @apiName DepositStake
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiParam (BodyParameter) {String} privatekey The privatekey of your address.
	 * @apiParam (BodyParameter) {Number} amount The amount to deposit to your stake.
	 *
	 * @apiUse Stake
	 *
	 * @apiSuccessExample {json} Success
	 * {
   *     "ok": true,
   *     "stake": {
	 *         "owner": "tttttttttt",
   *         "amount": 2500,
   *         "active": true
	 *     }
   * }
	 *
	 * @apiErrorExample {json} Insufficient Funds
	 * {
     *     "ok": false,
     *     "error": "insufficient_funds"
     * }
	 */
     app.post("/staking", async function(req, res) {
      try {
        const { userAgent, origin } = utils.getReqDetails(req);
        const address = await stakingController.deposit(req, req.body.privatekey, req.body.amount, userAgent, origin);
        res.json({
          ok: true,
          stake: stakingController.stakeToJSON(address)
        });
      } catch (error) {
        utils.sendErrorToRes(req, res, error);
      }
    });

    /**
	 * @api {post} /staking/withdraw Withdraw a stake
	 * @apiName WithdrawStake
	 * @apiGroup StakingGroup
	 * @apiVersion 2.15.0
	 *
	 * @apiParam (BodyParameter) {String} privatekey The privatekey of your address.
	 * @apiParam (BodyParameter) {Number} amount The amount to withdraw from your stake.
	 *
	 * @apiUse Stake
	 *
	 * @apiSuccessExample {json} Success
	 * {
   *     "ok": true,
   *     "stake": {
	 *         "owner": "tttttttttt",
   *         "amount": 0,
   *         "active": false
	 *     }
   * }
	 *
	 * @apiErrorExample {json} Insufficient Funds
	 * {
     *     "ok": false,
     *     "error": "insufficient_funds"
     * }
	 */
     app.post("/staking/withdraw", async function(req, res) {
      try {
        const { userAgent, origin } = utils.getReqDetails(req);
        const address = await stakingController.withdraw(req, req.body.privatekey, req.body.amount, userAgent, origin);
        res.json({
          ok: true,
          stake: stakingController.stakeToJSON(address)
        });
      } catch (error) {
        utils.sendErrorToRes(req, res, error);
      }
    });

  return app;
};

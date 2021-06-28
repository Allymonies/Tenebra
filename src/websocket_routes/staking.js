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

 const staking = require("./../controllers/staking.js");
 
 module.exports = function(websockets) {
   /**
      * @api {ws} //ws:"type":"stake" Get an address
      * @apiName WSGetStake
      * @apiGroup WebsocketGroup
      * @apiVersion 2.15.0
      *
      * @apiParam (WebsocketParameter) {Number} id
      * @apiParam (WebsocketParameter) {String="stake"} type
      * @apiParam (WebsocketParameter) {String} address
      *
      * @apiUse Stake
      */
 
   websockets.addMessageHandler("stake", async function(ws, message) {
        const stake = await staking.getStake(message.address)
        return {
            ok: true,
            stake: staking.stakeToJSON(stake)
        };
     });
}
 
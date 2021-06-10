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
 * For more project information, see <https://github.com/tmpim/tenebra>.
 */

const addr = require("./../controllers/addresses.js");

module.exports = function(websockets) {
  /**
	 * @api {ws} //ws:"type":"address" Get an address
	 * @apiName WSGetAddress
	 * @apiGroup WebsocketGroup
	 * @apiVersion 2.0.4
	 *
	 * @apiParam (WebsocketParameter) {Number} id
	 * @apiParam (WebsocketParameter) {String="address"} type
	 * @apiParam (WebsocketParameter) {String} address
	 * @apiParam (WebsocketParameter) {Boolean} [fetchNames] When supplied, fetch
   *   the count of names owned by the address.
	 *
	 * @apiUse Address
	 */

  websockets.addMessageHandler("address", async function(ws, message) {
    const fetchNames = !!message.fetchNames;
    const address = await addr.getAddress(message.address, fetchNames);
    return {
      ok: true,
      address: addr.addressToJSON(address)
    };
  });
};

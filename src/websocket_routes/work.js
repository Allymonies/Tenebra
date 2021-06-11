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

module.exports = function(websockets) {
  /**
	 * @api {ws} //ws:"type":"work" Get the current work
	 * @apiName WSGetWork
	 * @apiGroup WebsocketGroup
	 * @apiVersion 2.0.1
	 *
	 * @apiParam (WebsocketParameter) {Number} id
	 * @apiParam (WebsocketParameter) {String="work"} type
	 *
	 * @apiSuccess {Number} work The current Tenebra work (difficulty)
	 *
	 * @apiSuccessExample {json} Success
	 * {
	 *     "ok": true,
	 *     "id": 1,
	 *     "work": 18750
     * }
	 */
  websockets.addMessageHandler("work", async () => ({
    ok: true,
    work: await tenebra.getWork()
  }));
};

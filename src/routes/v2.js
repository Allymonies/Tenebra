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

const tenebra  = require("./../tenebra.js");
const utils  = require("./../utils.js");
const errors = require("./../errors/errors.js");

module.exports = function(app) {
  app.get("/", function(req, res, next) {
    if (req.query.v2) {
      return res.send(tenebra.makeV2Address(req.query.v2));
    }

    next();
  });

  /**
	 * @api {post} /v2 Get v2 address from a private key
	 * @apiName MakeV2Address
	 * @apiGroup MiscellaneousGroup
	 * @apiVersion 2.0.0
	 *
	 * @apiParam (BodyParameter) {String} privatekey The private key to turn into an address
	 *
	 * @apiSuccess {String} address The address from the private key
	 *
	 * @apiSuccessExample {json} Success
	 * {
	 *     "ok": true,
	 *     "address": "tre3w0i79j"
     * }
	 */
  app.post("/v2", function(req, res) {
    if (!req.body.privatekey) {
      return utils.sendErrorToRes(req, res, new errors.ErrorMissingParameter("privatekey"));
    }

    res.json({
      ok: true,
      address: tenebra.makeV2Address(req.body.privatekey)
    });
  });

  return app;
};

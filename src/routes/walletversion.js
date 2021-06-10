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

const tenebra = require("./../tenebra.js");

module.exports = function(app) {
  app.get("/", function(req, res, next) {
    if (typeof req.query.getwalletversion !== "undefined") {
      return res.send(tenebra.getWalletVersion().toString());
    }

    next();
  });

  /**
	 * @api {get} /walletversion Get latest TenebraWallet version
	 * @apiName GetWalletVersion
	 * @apiGroup MiscellaneousGroup
	 * @apiVersion 2.0.0
	 *
	 * @apiSuccess {Number} walletVersion The latest TenebraWallet version.
	 *
	 * @apiSuccessExample {json} Success
	 * {
     *     "ok": true,
     *     "walletVersion": 14
     * }
	 */
  app.get("/walletversion", function(req, res) {
    res.header("Content-Type", "application/json");

    res.json({
      ok: true,	
      walletVersion: tenebra.getWalletVersion()
    });
  });

  return app;
};

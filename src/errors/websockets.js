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

const util   = require("util");
const errors = require("./errors.js");

errors.ErrorInvalidWebsocketToken = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 403;
  this.errorString = "invalid_token";
};

util.inherits(errors.ErrorInvalidWebsocketToken, errors.TenebraError);

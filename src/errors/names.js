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

const util   = require("util");
const errors = require("./errors.js");

errors.ErrorNameNotFound = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 404;
  this.errorString = "name_not_found";
};

util.inherits(errors.ErrorNameNotFound, errors.TenebraError);

errors.ErrorNameTaken = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 409;
  this.errorString = "name_taken";
};

util.inherits(errors.ErrorNameTaken, errors.TenebraError);

errors.ErrorNotNameOwner = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 403;
  this.errorString = "not_name_owner";
};

util.inherits(errors.ErrorNotNameOwner, errors.TenebraError);

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

errors.ErrorBlockNotFound = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 404;
  this.errorString = "block_not_found";
};

util.inherits(errors.ErrorBlockNotFound, errors.TenebraError);

errors.ErrorSolutionIncorrect = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 403;
  this.errorString = "solution_incorrect";
};

util.inherits(errors.ErrorSolutionIncorrect, errors.TenebraError);

errors.ErrorSolutionDuplicate = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 409;
  this.errorString = "solution_duplicate";
};

util.inherits(errors.ErrorSolutionDuplicate, errors.TenebraError);

errors.ErrorMiningDisabled = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 423;
  this.errorString = "mining_disabled";
};

util.inherits(errors.ErrorMiningDisabled, errors.TenebraError);

errors.UnselectedValidator = function(message) {
  errors.TenebraError.call(this);
  this.message = message;
  this.statusCode = 403;
  this.errorString = "unselected_validator";
};

util.inherits(errors.UnselectedValidator, errors.TenebraError);
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

const addresses = require("./../addresses.js");
const tenebra     = require("./../tenebra.js");
const errors    = require("./../errors/errors.js");

function AddressesController() {}

AddressesController.getAddresses = function(limit, offset) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    addresses.getAddresses(limit, offset).then(resolve).catch(reject);
  });
};

AddressesController.getRich = function(limit, offset) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    addresses.getRich(limit, offset).then(resolve).catch(reject);
  });
};

AddressesController.getAddress = async function(address, fetchNames) {
  if (!tenebra.isValidTenebraAddress(address))
    throw new errors.ErrorInvalidParameter("address");

  const result = await addresses.getAddress(address, !!fetchNames);
  if (!result) throw new errors.ErrorAddressNotFound();

  return result;
};

AddressesController.getAlert = function(privatekey) {
  return new Promise(function(resolve, reject) {
    const address = tenebra.makeV2Address(privatekey);

    addresses.getAddress(address).then(function(result) {
      if (!result) {
        return reject(new errors.ErrorAddressNotFound());
      }

      resolve(result.alert);
    }).catch(reject);
  });
};

AddressesController.addressToJSON = function(address) {
  return addresses.addressToJSON(address);
};

module.exports = AddressesController;

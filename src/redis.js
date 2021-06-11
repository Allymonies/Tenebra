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

const chalk = require("chalk");
const { createNodeRedisClient } = require("handy-redis");

let redis;

module.exports = {
  getRedis() {
    return redis;  
  },

  init() {
    const isTest = process.env.NODE_ENV === "test";

    const host = process.env.REDIS_HOST || "127.0.0.1";
    const port = parseInt(process.env.REDIS_PORT) || 6379;
    const password = process.env.REDIS_PASSWORD || undefined;
    const prefix = isTest ? (process.env.TEST_REDIS_PREFIX || "test_tenebra:") : (process.env.REDIS_PREFIX || "tenebra:");
    
    console.log(chalk`{cyan [Redis]} Connecting to redis`);
    redis = createNodeRedisClient({
      host,
      port,
      password,
      prefix
    });
    console.log(chalk`{green [Redis]} Connected`);
  }
};

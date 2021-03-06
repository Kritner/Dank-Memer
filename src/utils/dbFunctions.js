module.exports = Bot => ({
  createGuild: async function createGuild (guildID) {
    await Bot.r.table('guilds')
      .insert({
        id: guildID,
        prefix: Bot.config.defaultPrefix,
        disabledCommands: []
      })
      .run()
    return this.getGuild(guildID)
  },

  getGuild: async function getGuild (guildID) {
    return Bot.r.table('guilds')
      .get(guildID)
      .run()
  },

  updateGuild: async function updateGuild (guildEntry) {
    return Bot.r.table('guilds')
      .insert(guildEntry, { conflict: 'update' })
      .run()
  },

  deleteGuild: async function deleteGuild (guildID) {
    return Bot.r.table('guilds')
      .get(guildID)
      .delete()
      .run()
  },

  addCooldown: async function addCooldown (command, ownerID) {
    const pCommand = Bot.cmds.find(c => c.props.triggers.includes(command.toLowerCase()))
    if (!pCommand) {
      return
    }
    const isDonor = await this.isDonor(ownerID)
    let cooldown
    if (isDonor && !pCommand.props.donorBlocked) {
      cooldown = pCommand.props.donorCD
    } else {
      cooldown = pCommand.props.cooldown
    }
    const profile = await this.getCooldowns(ownerID)
    if (!profile) {
      return this.createCooldowns(command, ownerID)
    }
    if (profile.cooldowns.some(cmd => cmd[command])) {
      profile.cooldowns.forEach(cmd => {
        if (cmd[command]) {
          cmd[command] = Date.now() + cooldown
        }
      })
    } else {
      profile.cooldowns.push({ [command]: Date.now() + cooldown })
    }
    return Bot.r.table('cooldowns')
      .insert({ id: ownerID, cooldowns: profile.cooldowns }, { conflict: 'update' })
  },

  createCooldowns: async function createCooldowns (command, ownerID) {
    const pCommand = Bot.cmds.find(c => c.props.triggers.includes(command.toLowerCase()))
    if (!pCommand) {
      return
    }
    const isDonor = await this.isDonor(ownerID)
    if (isDonor && !pCommand.props.donorBlocked) {
      const cooldown = pCommand.props.donorCD
      return Bot.r.table('cooldowns')
        .insert({ id: ownerID, cooldowns: [ { [command]: Date.now() + cooldown } ] })
    }
    const cooldown = pCommand.props.cooldown
    return Bot.r.table('cooldowns')
      .insert({ id: ownerID, cooldowns: [ { [command]: Date.now() + cooldown } ] })
  },

  getCooldowns: async function getCooldown (ownerID) {
    return Bot.r.table('cooldowns')
      .get(ownerID)
      .run()
  },

  clearCooldowns: async function clearCooldowns (ownerID) {
    return Bot.r.table('cooldowns')
      .get(ownerID)
      .delete()
      .run()
  },

  getCooldown: async function getCooldown (command, ownerID) {
    const profile = await Bot.r.table('cooldowns').get(ownerID).run()
    if (!profile) {
      return 1
    }
    const cooldowns = profile.cooldowns.find(item => item[command])
    if (!cooldowns) {
      return 1
    }
    return profile.cooldowns.find(item => item[command])[command]
  },

  addBlock: async function addBlock (id) {
    return Bot.r.table('blocked')
      .insert({ id })
      .run()
  },

  removeBlock: async function removeBlock (id) {
    return Bot.r.table('blocked')
      .get(id)
      .delete()
      .run()
  },

  isBlocked: async function isBlocked (guildID, authorID = 1) {
    const res = await Bot.r.table('blocked').get(guildID).run() ||
                await Bot.r.table('blocked').get(authorID).run()

    return Boolean(res)
  },

  addPls: async function addPls (guildID, userID) {
    let pls = await this.getPls(guildID)
    let userPls = await this.getUser(userID)
    if (!pls) {
      return this.initPls(guildID)
    }
    if (!userPls) {
      return this.initUser(userID)
    }
    if (!userPls.pls) {
      return this.updateLegacyUser(userID)
    }
    pls.pls++
    userPls.pls++

    Bot.r.table('users')
      .insert(userPls, {conflict: 'update'})
      .run()

    return Bot.r.table('pls')
      .insert(pls, { conflict: 'update' })
      .run()
  },

  initPls: async function initPls (guildID) {
    return Bot.r.table('pls')
      .insert({
        id: guildID,
        pls: 1
      })
      .run()
  },

  deletePls: async function deletePls (guildID) {
    return Bot.r.table('pls')
      .get(guildID)
      .delete()
      .run()
  },

  getPls: async function getPls (guildID) {
    let pls = await Bot.r.table('pls')
      .get(guildID)
      .run()
    if (!pls) {
      this.initPls(guildID)
      return 0
    }
    return pls
  },

  topPls: async function topPls () {
    const res = await Bot.r.table('pls')
      .orderBy({index: Bot.r.desc('pls')})
      .limit(15)
      .run()
    return res
  },

  initUser: async function initUser (id) {
    return Bot.r.table('users')
      .insert({
        id: id,
        coin: 0,
        pls: 1,
        lastCmd: Date.now(),
        spam: 0,
        streak: { time: 0, streak: 0 },
        upvoted: false
      }, { conflict: 'update', returnChanges: true })
      .run()
  },

  topUsers: async function topUsers () {
    const res = await Bot.r.table('users')
      .orderBy({index: Bot.r.desc('pls')})
      .limit(15)
      .run()
    return res
  },

  updateLegacyUser: async function updateLegacyUser (id) {
    return Bot.r.table('users')
      .insert({
        id: id,
        pls: 1,
        lastCmd: Date.now(),
        spam: 0,
        streak: { time: 0, streak: 0 },
        upvoted: false
      }, { conflict: 'update', returnChanges: true })
      .run()
  },

  getUser: async function getUser (userID) {
    let pls = await Bot.r.table('users')
      .get(userID)
      .run()
    if (!pls) {
      pls = await this.initUser(userID)
      if (pls.changes[0]) {
        pls = pls.changes[0].new_val
      }
      return pls
    }
    if (!pls.lastCmd || !pls.spam) {
      pls.spam = 0
      pls.lastCmd = Date.now()
    }
    return pls
  },

  removeUser: async function removeUser (userID) {
    return Bot.r.table('users')
      .get(userID)
      .delete()
      .run()
  },

  isVoter: async function isVoter (id) {
    let user = await this.getUser(id)
    return user.upvoted
  },

  addCoins: async function addCoins (id, amount) {
    let coins = await this.getCoins(id)
    coins.coin += amount

    return Bot.r.table('users')
      .insert(coins, { conflict: 'update' })
  },

  topCoins: async function topCoins () {
    const res = await Bot.r.table('users')
      .orderBy({index: Bot.r.desc('coin')})
      .limit(15)
      .run()
    return res
  },

  fixCoins: async function fixCoins (id, amount) {
    let coins = await this.getCoins(id)
    coins.coin = Math.round(coins.coin)

    Bot.r.table('users')
      .insert(coins, { conflict: 'update' })
    return coins
  },

  removeCoins: async function removeCoins (id, amount) {
    let coins = await this.getCoins(id)

    coins.coin = Math.max(0, coins.coin - amount)

    return Bot.r.table('users')
      .insert(coins, { conflict: 'update' })
  },

  getCoins: async function getCoins (id) {
    const coins = await Bot.r.table('users')
      .get(id)
      .default({ id, coin: 0 })
      .run()

    return coins
  },

  addStreak: async function addStreak (id) {
    let { streak } = await this.getStreak(id)
    if (!streak) {
      streak = {}
    }

    streak.time = Date.now()
    streak.streak = ~~streak.streak + 1

    await Bot.r.table('users').insert({ id, streak }, { conflict: 'update' }).run()
  },

  addSpam: async function addSpam (id) {
    let { spam } = await this.getSpam(id)
    spam = ~~spam + 1

    await Bot.r.table('users').insert({ id, spam }, { conflict: 'update' }).run()
  },

  topSpam: async function topSpam () {
    const res = await Bot.r.table('users')
      .orderBy({index: Bot.r.desc('spam')})
      .limit(10)
      .run()
    return res
  },

  addCmd: async function addCmd (id) {
    let { lastCmd } = await this.getSpam(id)
    lastCmd = Date.now()
    await Bot.r.table('users').insert({ id, lastCmd }, { conflict: 'update' }).run()
  },

  getSpam: async function getSpam (id) {
    let users = await this.getUser(id)
    return users
  },

  getStreak: async function getStreak (id) {
    let users = await this.getUser(id)
    return users
  },

  resetStreak: async function removeStreak (id) {
    const streak = {
      time: Date.now(),
      streak: 1
    }
    await Bot.r.table('users').insert({ id, streak }, { conflict: 'update' }).run()
  },

  addDonor: async function addDonor (id, donorAmount) {
    return Bot.r.table('donors')
      .insert({ id, donorAmount }, { conflict: 'update' })
      .run()
  },

  removeDonor: async function removeDonor (id) {
    return Bot.r.table('donors')
      .get(id)
      .delete()
      .run()
  },

  isDonor: async function isDonor (id) {
    const res = await Bot.r.table('donors')
      .get(id)
      .run()
    return res ? res.donorAmount : false
  },

  getStats: async function getStats () {
    const res = await Bot.r.table('stats')
      .get(1)
      .run()
    return res.stats
  }
})

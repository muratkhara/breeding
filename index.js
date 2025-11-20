require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const bahceler = new Map();
const activeSeeds = new Map();

client.on('ready', async () => {
  console.log(`${client.user.tag} çevrimiçi! 🌱 Tohum oyunu aktif!`);
  const cmds = [
    new SlashCommandBuilder().setName('tohum').setDescription('Tohum gönder').addUserOption(o => o.setName('kisi').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni gör'),
    new SlashCommandBuilder().setName('hasat').setDescription('Hasat et')
  ];
  await client.application.commands.set(cmds.map(c => c.toJSON()));
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const getData = id => bahceler.get(id) || {plantTime: 0, coin: 0};
  const setData = (id, obj) => bahceler.set(id, obj);

  if (i.commandName === 'tohum') {
    const target = i.options.getUser('kisi');
    if (target.id === i.user.id || target.bot) return i.reply({content:'Geçersiz!',ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('kabul_'+i.id).setLabel('Kabul').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('red_'+i.id).setLabel('Reddet').setStyle(ButtonStyle.Danger)
    );

    await i.reply({content:`<@${target.id}>, <@${i.user.id}> sana tohum gönderdi!`, components:[row]});
    activeSeeds.set(i.id, target.id);
  }

  if (i.commandName === 'bahce') {
    const d = getData(i.user.id);
    const kalanGun = d.plantTime ? Math.ceil((604800000 - (Date.now() - d.plantTime)) / 86400000) : 0;
    const msg = d.plantTime ? (kalanGun <= 0 ? '🍎 Hasat hazır!' : `🌱 Çimlendi! Kalan ${kalanGun} gün`) : '🌾 Bahçen boş';
    await i.reply({embeds:[new EmbedBuilder().setTitle(`${i.user.username}'ın Bahçesi`).setDescription(msg).addFields({name:'💰 Coin',value:String(d.coin)}).setColor(0x00ff00)]});
  }

  if (i.commandName === 'hasat') {
    const d = getData(i.user.id);
    if (!d.plantTime || Date.now() - d.plantTime < 604800000) return i.reply({content:'Henüz hazır değil!',ephemeral:true});
    setData(i.user.id, {plantTime: 0, coin: d.coin + 100});
    await i.reply(`🎉 Hasat başarılı! +100 coin kazandın! Toplam ${d.coin + 100} 💰`);
  }

  if (i.isButton()) {
    const [action, id] = i.customId.split('_');
    if (i.user.id !== activeSeeds.get(id)) return;

    if (action === 'kabul') {
      setData(i.user.id, {plantTime: Date.now(), coin: getData(i.user.id).coin});
      await i.update({content:`**${i.user.username}'ın bahçesi çimlendi!**\n1 hafta sonra hasat = +100 coin`, embeds:[], components:[]});
    } else {
      await i.update({content:'Tohum reddedildi.', components:[]});
    }
    activeSeeds.delete(id);
  }
});

client.login(process.env.TOKEN);

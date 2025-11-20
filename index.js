require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const bahceler = new Map(); // userId => {plantTime: number, coin: number}
const activeSeeds = new Map();

client.on('ready', async () => {
  console.log(`${client.user.tag} çevrimiçi! Tohum oyunu hazır`);

  const cmds = [
    new SlashCommandBuilder().setName('tohum').setDescription('Tohum gönder').addUserOption(o => o.setName('kisi').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni gör'),
    new SlashCommandBuilder().setName('hasat').setDescription('Hasat et')
  ];
  await client.application.commands.set(cmds.map(c => c.toJSON()));
});

client.on('interactionCreate', async i => {
  if (i.isChatInputCommand()) {
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
      const data = bahceler.get(i.user.id) || {plantTime:0, coin:0};
      };
      const msg = data.plantTime && Date.now() - data.plantTime < 604800000 ? `Çimlendi! Kalan ~${Math.ceil((604800000 - (Date.now() - data.plantTime))/86400000)} gün` : data.plantTime ? 'Hasat hazır!' : 'Bahçen boş';
      await i.reply({embeds:[new EmbedBuilder().setTitle('Bahçen').setDescription(msg).addFields({name:'Coin',value:String(data.coin)})]});
    }

    if (i.commandName === 'hasat') {
      const data = bahceler.get(i.user.id) || {plantTime:0, coin:0};
      if (!data.plantTime || Date.now() - data.plantTime < 604800000) return i.reply({content:'Henüz hazır değil!',ephemeral:true});
      bahceler.set(i.user.id, {plantTime:0, coin: data.coin + 100});
      await i.reply(`Hasat başarılı! +100 coin kazandın!`);
    }
  }

  if (i.isButton()) {
    const [action, id] = i.customId.split('_');
    if (i.user.id !== activeSeeds.get(id)) return;

    if (action === 'kabul') {
      bahceler.set(i.user.id, {plantTime: Date.now(), coin: (bahceler.get(i.user.id)?.coin || 0)});
      await i.update({content: `**${i.user.username}'ın bahçesi çimlendi!**\n1 hafta sonra hasat = +100 coin`, embeds: [], components: []});
    } else {
      await i.update({content: 'Tohum reddedildi.', components: []});
    }
    activeSeeds.delete(id);
  }
});

client.login(process.env.TOKEN);

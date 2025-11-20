require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const bahceler = new Map(); // userId => data
const activeSeeds = new Map();

client.on('ready', async () => {
  => {
  console.log(`${client.user.tag} çevrimiçi! 🌱`);

  const commands = [
    new SlashCommandBuilder().setName('tohum').setDescription('Tohum gönder').addUserOption(o => o.setName('kullanici').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni gör'),
    new SlashCommandBuilder().setName('hasat').setDescription('Hasat et (+100 coin)')
  ];

  await client.application.commands.set(commands.map(c => c.toJSON()));
});

client.on('interactionCreate', async i => {
  if (i.isChatInputCommand()) {
    if (i.commandName === 'tohum') {
      const target = i.options.getUser('kullanici');
      if (target.id === i.user.id || target.bot) return i.reply({content:'Geçersiz!',ephemeral:true});

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('kabul_'+i.id).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('red_'+i.id).setLabel('Reddet').setStyle(ButtonStyle.Danger)
      );

      await i.reply({content:`<@${target.id}>, <@${i.user.id}> sana tohum gönderdi!`, components:[row]});
      activeSeeds.set(i.id, target.id);
    }

    if (i.commandName === 'bahce') {
      const data = bahceler.get(i.user.id) || {coin:0, plantTime:null};
      const msg = data.plantTime ? (Date.now() - data.plantTime >= 604800000 ? 'Hasat hazır!' : 'Çimlendi, bekle...') : 'Boş bahçe';
      await i.reply({embeds:[new EmbedBuilder().setTitle('Bahçen').setDescription(msg).addFields({name:'Coin',value:String(data.coin)})]});
    }

    if (i.commandName === 'hasat') {
      const data = bahceler.get(i.user.id) || {coin:0, plantTime:null};
      if (!data.plantTime || Date.now() - data.plantTime < 604800000) return i.reply({content:'Henüz hazır değil!',ephemeral:true});
      bahceler.set(i.user.id, {coin: data.coin + 100, plantTime:null});
      await i.reply('Hasat başarılı! +100 coin');
    }
  }

  if (i.isButton()) {
    const [islem, id] = i.customId.split('_');
    if (i.user.id !== activeSeeds.get(id)) return;

    if (islem === 'kabul') {
      bahceler.set(i.user.id, {coin: (bahceler.get(i.user.id)?.coin || 0), plantTime: Date.now()});
      await i.update({content:'', embeds:[new EmbedBuilder().setTitle('Bahçe Çimlendi!').setDescription(`${i.user.username}'ın bahçesi çimlendi!\n1 hafta sonra hasat = +100 coin`).setColor(0x00ff00)], components:[]});
    } else {
      await i.update({content:'Tohum reddedildi.', components:[]});
    }
    activeSeeds.delete(id);
  );
  }
});

client.login(process.env.TOKEN);

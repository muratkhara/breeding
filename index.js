require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// Basit veritabanı: sadece RAM'de tutar ama Pella ücretsiz planda restart atmadığı için sorun olmaz
const bahceler = new Map(); // userId => {seviye: 0/1, plantTime: number, coin: number}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const activeSeeds = new Map();

client.once('ready', async () => {
  console.log(`${client.user.tag} hazır! 🌱 Tohum oyunu aktif!`);

  const commands = [
    new SlashCommandBuilder()
      .setName('tohum')
      .setDescription('Birine tohum gönder!')
      .addUserOption(o => o.setName('kullanici').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni kontrol et'),
    new SlashCommandBuilder().setName('hasat').setDescription('1 hafta dolduysa hasat et (+100 coin)')
  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
});

client.on('interactionCreate', async i => {
  if (!i.isChatInputCommand() && !i.isButton()) return;

  const getData = (userId) => bahceler.get(userId) || {seviye: 0, plantTime: null, coin: 0};
  const setData = (userId, data) => bahceler.set(userId, data);

  // TOHUM
  if (i.commandName === 'tohum') {
    const target = i.options.getUser('kullanici');
    if (target.id === i.user.id || target.bot) return i.reply({content:'Geçersiz hedef!',ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kabul_${i.id}`).setLabel('Kabul Et').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`red_${i.id}`).setLabel('Reddet').setStyle(ButtonStyle.Danger)
    );

    await i.reply({content:`<@${target.id}>, <@${i.user.id}> sana tohum gönderdi!`, components:[row]});
    activeSeeds.set(i.id, {target: target.id});
  }

  // BAHÇE
  if (i.commandName === 'bahce') {
    const data = getData(i.user.id);
    let msg = data.seviye === 1 && data.plantTime ? 
      (Date.now() - data.plantTime >= 7*24*60*60*1000 ? '🍎 Hasat hazır!' : `🌱 Çimlendi, biraz daha bekle...`) : 
      '🌾 Bahçen boş!';

    const embed = new EmbedBuilder()
      .setTitle(`${i.user.username}'ın Bahçesi`)
      .setDescription(msg)
      .addFields({name:'💰 Coin', value: `${data.coin}`})
      .setColor(data.seviye === 1 ? 0x00ff00 : 0x888888);

    await i.reply({embeds:[embed]});
  }

  // HASAT
  if (i.commandName === 'hasat') {
    const data = getData(i.user.id);
    if (data.seviye !== 1 || Date.now() - data.plantTime < 7*24*60*60*1000) {
      return i.reply({content:'Henüz hazır değil!',ephemeral:true});
    }

    setData(i.user.id, {seviye: 0, plantTime: null, coin: data.coin + 100});
    await i.reply(`🎉 Hasat başarılı! +100 coin kazandın! Toplam: ${data.coin + 100}`);
  }

  // BUTONLAR
  if (i.isButton()) {
    const [islem, id] = i.customId.split('_');
    const teklif = activeSeeds.get(id);
    if (!teklif || i.user.id !== teklif.target) return;

    if (islem === 'kabul') {
      setData(i.user.id, {seviye: 1, plantTime: Date.now(), coin: getData(i.user.id).coin});

      const embed = new EmbedBuilder()
        .setTitle('🌟 Bahçe Çimlendi!')
        .setDescription(`**${i.user.username}'ın bahçesi çimlendi!**\n1 hafta sonra hasat edebilirsin (+100 coin)`)
        .setColor(0x32CD32);

      await i.update({content:'', embeds:[embed], components:[]});
    } else {
      await i.update({content:'❌ Tohum reddedildi.', embeds:[], components:[]});
    }
    activeSeeds.delete(id);
  }
});

client.login(process.env.TOKEN);

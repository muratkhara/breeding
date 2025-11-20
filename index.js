require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { QuickDB } = require('quick.db');
const db = new QuickDB();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const activeSeeds = new Map(); // geçici tohum teklifleri

client.once('ready', async () => {
  console.log(`${client.user.tag} hazır! 🌱 Tohum oyunu aktif!`);

  const commands = [
    new SlashCommandBuilder()
      .setName('tohum')
      .setDescription('Birine tohum gönder!')
      .addUserOption(option => option.setName('kullanici').setDescription('Kişi').setRequired(true)),
    new SlashCommandBuilder().setName('bahce').setDescription('Bahçeni kontrol et'),
    new SlashCommandBuilder().setName('hasat').setDescription('1 hafta dolduysa hasat et (+100 coin)')
  ].map(c => c.toJSON());

  await client.application.commands.set(commands);
  console.log('Komutlar yüklendi!');
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand() && !interaction.isButton()) return;

  // TOHUM GÖNDER
  if (interaction.commandName === 'tohum') {
    const target = interaction.options.getUser('kullanici');
    if (target.id === interaction.user.id) return interaction.reply({content:'Kendine tohum gönderemezsin!',ephemeral:true});
    if (target.bot) return interaction.reply({content:'Botlara tohum gönderemezsin!',ephemeral:true});

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`kabul_${interaction.id}`).setLabel('✅ Kabul Et').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`red_${interaction.id}`).setLabel('❌ Reddet').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({
      content: `<@${target.id}>, <@${interaction.user.id}> sana tohum gönderdi! Bahçen çimlenecek mi?`,
      components: [row]
    });
    activeSeeds.set(interaction.id, {target: target.id, sender: interaction.user.id});
  }

  // BAHÇE GÖRÜNTÜLE
  if (interaction.commandName === 'bahce') {
    const data = await db.get(`bahce_${interaction.user.id}`) || {seviye: 0, plantTime: null, coin: 0};
    let mesaj = '';

    if (data.seviye === 1 && data.plantTime) {
      const kalanMs = 7*24*60*60*1000 - (Date.now() - data.plantTime);
      if (kalanMs <= 0) {
        mesaj = '🍎 **Hasat hazır!** `/hasat` ile 100 coin kazan!';
      } else {
        const gün = Math.floor(kalanMs / (24*60*60*1000));
        const saat = Math.floor((kalanMs % (24*60*60*1000)) / (60*60*1000));
        mesaj = `🌱 Çimlendi! Kalan: ${gün} gün ${saat} saat`;
      }
    } else {
      mesaj = '🌾 Bahçen boş. Birinden tohum iste!';
    }

    const embed = new EmbedBuilder()
      .setTitle(`${interaction.user.username}'ın Bahçesi`)
      .setDescription(mesaj)
      .addFields({ name: '💰 Coin', value: `${data.coin}`, inline: true })
      .setColor(data.seviye === 1 ? 0x00ff00 : 0xff0000);

    await interaction.reply({embeds:[embed]});
  }

  // HASAT
  if (interaction.commandName === 'hasat') {
    const data = await db.get(`bahce_${interaction.user.id}`) || {seviye: 0, plantTime: null, coin: 0};
    if (data.seviye !== 1 || !data.plantTime || Date.now() - data.plantTime < 7*24*60*60*1000) {
      return interaction.reply({content:'❌ Henüz hasat zamanı gelmedi!',ephemeral:true});
    }

    await db.set(`bahce_${interaction.user.id}`, {seviye: 0, plantTime: null, coin: data.coin + 100});

    await interaction.reply(`🎉 **Hasat başarılı! +100 coin kazandın!**\nToplam coin: ${data.coin + 100}`);
  }

  // BUTONLAR
  if (interaction.isButton()) {
    const [islem, id] = interaction.customId.split('_');
    const teklif = activeSeeds.get(id);
    if (!teklif || interaction.user.id !== teklif.target) return;

    if (islem === 'kabul') {
      await db.set(`bahce_${interaction.user.id}`, {seviye: 1, plantTime: Date.now(), coin: (await db.get(`bahce_${interaction.user.id}`)?.coin || 0)});
      
      const embed = new EmbedBuilder()
        .setTitle('🌟 Bahçe Çimlendi!')
        .setDescription(`**${interaction.user.username}'ın bahçesi çimlendi!**\n1 hafta sonra hasat edebilirsin (+100 coin)`)
        .setColor(0x32CD32);

      await interaction.update({content: '', embeds: [embed], components: []});
    } else {
      await interaction.update({content: '❌ Tohum reddedildi, bahçe boş kaldı.', embeds: [], components: []});
    }
    activeSeeds.delete(id);
  }
});

client.login(process.env.TOKEN);

// Utilisation du middleware de session
const { Telegraf, session } = require('telegraf');
require('dotenv').config();
const { TELEGRAM_API_KEY } = process.env;
const bot = new Telegraf(TELEGRAM_API_KEY);

const fs = require('fs');

const lockFile = 'bot.lock';

if (fs.existsSync(lockFile)) {
    console.error('Une autre instance est déjà en cours d\'exécution.');
    process.exit(1);
}

// Créez le fichier de verrouillage
fs.writeFileSync(lockFile, '');

// Initialisez et lancez votre bot ici

// ...

// Supprimez le fichier de verrouillage lorsque le programme se termine
process.on('exit', () => {
    fs.unlinkSync(lockFile);
});


//Initialisation de la base de données
const sqlite3 = require('sqlite3').verbose();
const dbPath = 'sqlstorage.db';
const db = new sqlite3.Database(dbPath);

//Express config
const express = require('express');
const app = express();
app.get('/', (req, res) => {
    res.send('Hello, World!');
});
const port = 3000;
app.listen(port, () => {
    console.log(`Serveur en cours d'exécution sur le port ${port}`);
});

//Variable Globale
const moment = require('moment');
let lastPredictionTime = null;
let NouvellePrediction = true;

// Utilisation de sessions pour stocker l'état par utilisateur
bot.use(session());


//#########################################################################################################################################

//Désactiver un utilisateur
bot.command('disabled_user', (ctx) => {
    const timestampActuel = Math.floor(Date.now() / 1000);
    db.run('UPDATE access_bot SET sta = 0 WHERE ? > day_exp', [timestampActuel], function (err) {
        if (err) {
            console.error('Erreur lors de la désactivation des utilisateurs expirés :', err);
            ctx.reply('Erreur lors de la désactivation des utilisateurs expirés.');
        }
        else {
            const CountUpdate = this.changes;
            if (CountUpdate > 0) {
                ctx.reply('Utilisateurs expirés désactivés avec succès.');
            }
            else {
                ctx.reply('Aucun utilisateur à désactiver.');
            }
        }
    });
});


//Liste des code générés
bot.command('code_liste_generate', (ctx) => {
    db.all(` SELECT * FROM code`, (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des codes :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            rows.forEach((row) => {
                const dateMoment = moment(row.date_exp);
                const formattedDateTime = dateMoment.format('YYYY-MM-DD HH:mm');
                ctx.reply(`Liste des Code ID:\n ${row.code_id}, Date expiration: ${formattedDateTime}\n`);
            });
        }
    });
});

//Liste des codes générés
bot.command('code_access', (ctx) => {

    db.all(`SELECT * FROM access_bot`, (err, rows) => {
        if (err) {
            console.error('Erreur lors de la récupération des codes :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            rows.forEach((row) => {
                const timestamp = row.day_exp;
                const date = new Date(timestamp);
                ctx.reply(`Liste des accès codes :\n ${row.access_id}, user : ${row.user_id}, Date expiration : ${date}, sta : ${row.sta} \n\n`);
            });
        }
    });
});

//Tout effacer
bot.command('delete_code', (ctx) => {
    db.run('DELETE FROM code', (err) => {
        if (err) {
            console.error('Erreur lors de la suppression des codes :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            ctx.reply('Tous les codes ont été supprimés.');
        }
    });
    db.run('DELETE FROM new_users', (err) => {
        if (err) {
            console.error('Erreur lors de la suppression des codes :', err);
            ctx.reply('Une erreur est survenue.');
        } else {
            ctx.reply('Tous les new_users ont été supprimés.');
        }
    });
    db.run('DELETE FROM access_bot', (err) => {
        if (err) {
            console.error('Erreur lors de la suppression des codes :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            ctx.reply('Tous les access_bot ont été supprimés.');
        }
    });
    db.run('DELETE FROM stats', (err) => {
        if (err) {
            console.error('Erreur lors de la suppression des codes :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            ctx.reply('Tous les stats ont été supprimés.');
        }
    });
});


//#########################################################################################################################################


const database = {}; // Simule une base de données

//Générer un code
bot.command('code_generation_commande', (ctx) => {

    // Fonction pour calculer la date d'expiration (1 mois et 10 jours)
    function calculateExpirationDate() {
        const currentDate = new Date();
        currentDate.setMonth(currentDate.getMonth() + 1);
        currentDate.setDate(currentDate.getDate() + 10);
        return currentDate;
    }
    const dateExpiration = calculateExpirationDate();

    // Fonction pour générer un code unique de manière similaire à la génération de prédictions
    function generateUniqueCode() {
        const currentTime = moment();
        const timestamp = currentTime.format('YYYYMMDDHHmmss');
        const randomNumber = Math.floor(Math.random() * 1000);
        const uniqueCode = `${timestamp}-${randomNumber}`;
        return uniqueCode;
    }
    const monCodeUnique = generateUniqueCode();

    db.run(`INSERT INTO code (code_id,date_exp) VALUES (?,?)`, [monCodeUnique, dateExpiration], (err) => {
        if (err) {
            console.error('Erreur lors de l\'insertion dans la table "code" :', err);
            ctx.reply('Une erreur est survenue.');
        }
        else {
            ctx.reply(`Inséré avec succes\n `);
        }
        // Fermer la base de données après avoir effectué les opérations
        // db.close();
    });
    ctx.reply(`${monCodeUnique}\n`);
    ctx.reply(`Code généré : ${monCodeUnique}\ndate d'expiration : ${dateExpiration}\n `);
});

// Middleware pour initialiser la session utilisateur
bot.use((ctx, next) => {
    const userId = ctx.from.id;
    // Assurez-vous que ctx.session est toujours défini
    ctx.session = ctx.session || {};
    // Assurez-vous que ctx.session.userState est initialisé
    ctx.session.userState = ctx.session.userState || {};
    // Assurez-vous que ctx.session.userState.predictionMade est initialisé
    ctx.session.userState.predictionMade = ctx.session.userState.predictionMade || false;
    ctx.session.userState.gameTime = ctx.session.userState.gameTime || null;
    return next();
});


// Gérer les message
bot.hears(/.*/, (ctx) => {
    const userId = ctx.from.id;
    // Vérifier si l'utilisateur existe dans la table "new_users"
    db.get('SELECT * FROM new_users WHERE user_id = ?', [userId], (err, user) => {
        if (err) {
            console.error('Erreur lors de la vérification de l\'utilisateur :', err);
            ctx.reply('Une erreur est survenue.');
        }

        // Si l'utilisateur n'existe pas, le créer
        if (!user) {
            db.run('INSERT INTO new_users (user_id, name) VALUES (?, ?)', [userId, ctx.from.username || 'Unknown'], (err) => {
                if (err) {
                    console.error('Erreur lors de la création de l\'utilisateur :', err);
                    ctx.reply('Une erreur est survenue.');
                }
            });
        }
    });

    // Vérifier la valeur de "sta" dans la table "access_bot"
    db.get('SELECT sta FROM access_bot WHERE user_id = ?', [userId], (err, accessBot) => {
        if (err) {
            console.error('Erreur lors de la vérification de access_bot :', err);
            ctx.reply('Une erreur est survenue.');
        }
        // Si la valeur de "sta" n'est pas égale à 1, demander le code
        if (!accessBot || accessBot.sta !== 1) {
            const code = ctx.message.text;
            const userId = ctx.from.id;
            db.get('SELECT * FROM code WHERE code_id = ?', [code], (err, row) => {
                if (err) {
                    console.error('Erreur lors de la vérification du code :', err);
                    ctx.reply('Une erreur est survenue.');
                }
                if (row) {
                    const dateExpiration = row.date_exp;
                    // Vérifier si l'utilisateur existe dans access_bot
                    const query = 'SELECT user_id FROM access_bot WHERE user_id = ?';
                    db.get(query, [userId], async (err, access_exist) => {
                        if (err) {
                            console.error('Erreur lors de la vérification de l\'utilisateur :', err);
                            ctx.reply('Erreur lors de la vérification de l\'utilisateur.');
                        } else {
                            if (access_exist) {
                                const updateQuery = 'UPDATE access_bot SET day_exp = ?, sta = 1 WHERE user_id = ?';
                                db.run(updateQuery, [dateExpiration, userId], (err) => {
                                    if (err) {
                                        console.error('Erreur lors de la mise à jour de l\'utilisateur :', err);
                                        ctx.reply('Une erreur est survenue.');
                                    }
                                });
                            } else {
                                // L'utilisateur n'existe pas, l'ajouter
                                db.run('INSERT INTO access_bot (access_id, user_id, day_exp, type_right,sta) VALUES (?, ?, ?, ?, ?)', [code, userId, dateExpiration, '1mois 10jours', 1 || 'Unknown'], (err) => {
                                    if (err) {
                                        console.error('Erreur lors de la création de l\'utilisateur :', err);
                                        ctx.reply('Une erreur est survenue.');
                                    }
                                });
                            }
                        }
                    });


                    db.run('DELETE FROM code', (err) => {
                        if (err) {
                            console.error('Erreur lors de la suppression des codes :', err);
                            ctx.reply('Une erreur est survenue.');
                        } else {
                            ctx.reply('Compte activé cliquez sur start.');
                            ctx.reply(code, {
                                reply_markup: {
                                    inline_keyboard: [
                                        [{ text: 'Start', callback_data: 'start' }],
                                    ],
                                },
                            });
                        }
                    });
                }
                else {
                    ctx.reply('Vous avez été enregistré !.\n Veuillez entrer votre code : ');
                }
            });
        }
        else {
            const messageText = ctx.message.text.toLowerCase();  // Convertir le texte en minuscules pour rendre la comparaison insensible à la casse
            if (messageText.includes('/start')) {
                // Gérer la commande /start
                ctx.reply('Bienvenue sur Flow Predictor (FP) !\nChoisissez votre option :', {
                    reply_markup: {
                        keyboard: [
                            ['Lucky Jet Prédiction (Signal ⚡️🚀)'],
                        ],
                        resize_keyboard: true,
                        one_time_keyboard: true,
                    },
                });
            }

            if (messageText.includes('lucky jet prédiction (signal ⚡️🚀)')) {
                //PROGRAMME DEBUT

                // Vérifier si l'utilisateur a déjà fait une prédiction
                if (ctx.session.userState.predictionMade) {
                    const remainingTime = ctx.session.userState.gameTime.diff(moment(), 'seconds');
                    const remainingMinutes = Math.floor(remainingTime / 60);
                    const remainingSeconds = remainingTime % 60;
                    if (remainingMinutes <= -1) {
                        ctx.session.userState.predictionMade = false;
                        ctx.session.userState.gameTime = null;
                    }
                    else {
                        ctx.reply(`🔴 Attendez que le temps de la prochaine prédiction soit arrivé. Prochaine mise à jour dans ${remainingMinutes} minutes et ${remainingSeconds} secondes.`);
                        return;
                    }
                }
                const currentTime = moment();
                // Fonction pour générer une prédiction normale
                function generateNormalPrediction(min, max, frequentProbability, rareProbability, veryRareProbability, specialProbability) {
                    // Générer un nombre aléatoire entre 0 et 1
                    const random = Math.random();

                    // Calculer le pourcentage en fonction de la plage de prédictions
                    percentage = (random * (99.99 - 80.00) + 80.00).toFixed(2);

                    // Si le nombre aléatoire est inférieur à la probabilité très rare, retourner une valeur spéciale
                    if (random < veryRareProbability) {
                        return (Math.random() * (max - 2) + 2).toFixed(2); // Retourner une valeur entre 2.0 et 100.0
                    }

                    // Si le nombre aléatoire est inférieur à la probabilité rare, retourner la valeur max avec une probabilité moins rare
                    if (random < rareProbability) {
                        return (Math.random() * (9 - min) + min).toFixed(2); // Retourner une valeur entre min et 9.0 (ajusté pour exclure 9.0)
                    }

                    // Si le nombre aléatoire est inférieur à la probabilité spéciale, retourner une valeur spéciale
                    if (random < specialProbability) {
                        return (Math.random() * (max - 2) + 2).toFixed(2); // Retourner une valeur entre 2.0 et 100.0
                    }

                    // Si la plage horaire est de 00h à 6h
                    if (currentTime.hours() >= 0 && currentTime.hours() < 6) {
                        return (Math.random() * (9 - 3.2) + 3.2).toFixed(2); // Retourner une valeur entre 3.2 et 9.0
                    }

                    // Si la plage horaire est de 6h à 12h
                    if (currentTime.hours() >= 6 && currentTime.hours() < 12) {
                        return (Math.random() * (9.9 - 2.9) + 2.9).toFixed(2); // Retourner une valeur entre 2.9 et 9.9
                    }

                    // Si la plage horaire est de 12h à 00h
                    if (currentTime.hours() >= 12 && currentTime.hours() < 24) {
                        return (Math.random() * (10 - 2.5) + 2.5).toFixed(2); // Retourner une valeur entre 2.5 et 10.0
                    }

                    // Par défaut, générer une prédiction normale entre min et max
                    return (Math.random() * (max - min) + min).toFixed(2);
                }

                // ...


                // Fonction pour générer une prédiction d'assurance
                function generateInsurancePrediction(normalPrediction) {
                    return (normalPrediction * 0.5).toFixed(2);
                }

                let normalPrediction;
                let insurancePrediction;
                // Générer des prédictions en fonction de l'heure actuelle
                if (currentTime.hours() >= 0 && currentTime.hours() < 6) {
                    // Plage horaire de 0h à 6h
                    normalPrediction = generateNormalPrediction(3.2, 100, 0.5, 0.2, 0.1, 0.05); // Probabilité fréquente de 50%, probabilité rare de 10%, probabilité très rare de 1%, probabilité spéciale de 2%
                    insurancePrediction = generateInsurancePrediction(normalPrediction);
                }

                // Si la plage horaire est de 6h à 12h
                if (currentTime.hours() >= 6 && currentTime.hours() < 12) {
                    // Plage horaire de 6h à 12h
                    normalPrediction = generateNormalPrediction(2.9, 30.9, 0.7, 0.2, 0.1, 0.05); // Probabilité fréquente de 70%, probabilité rare de 5%, probabilité très rare de 1%, probabilité spéciale de 2%
                    insurancePrediction = generateInsurancePrediction(normalPrediction);
                }

                // Si la plage horaire est de 12h à 00h
                if (currentTime.hours() >= 12 && currentTime.hours() < 24) {
                    // Plage horaire de 12h à 24h
                    normalPrediction = generateNormalPrediction(2.8, 50, 0.5, 0.2, 0.1, 0.05); // Probabilité fréquente de 60%, probabilité rare de 2%, probabilité très rare de 0.5%, probabilité spéciale de 1%
                    insurancePrediction = generateInsurancePrediction(normalPrediction);
                }

                const gameTime = currentTime.add(4, 'minutes');

                const predictionMessage = `🚀 Nouveau signal:\n coefficient : ${normalPrediction}\n coefficient de sécurité : ${insurancePrediction}\n confiance : ${percentage}%\n` +
                    ` Heure de jeux : ${gameTime.format('HH:mm')}\n`;

                // Marquez que l'utilisateur a fait une prédiction et stockez l'heure de jeu
                ctx.session.userState.predictionMade = true;
                ctx.session.userState.gameTime = gameTime;


                ctx.reply(predictionMessage, {
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Gagné', callback_data: 'win' }],
                            [{ text: 'Perdu', callback_data: 'lose' }],
                        ],
                    },
                });
                ctx.reply('  votre satisfaction nous intéresse !');

            }
            else {
                if (messageText.includes('/help')) {
                    ctx.reply(
                        "🚀 Bienvenue sur ExpressFlowBot Prédictions Bot! 🚀 \n" +
                        "✨ Laissez la chance vous guider vers la victoire avec notre compagnon de jeu exclusif sur Telegram! ✨ \n" +
                        "🔮 Prédictions de haut niveau : \n" +
                        "LuckyJet Predictions Bot utilise une technologie de pointe pour vous offrir des prédictions précises et fiables pour le jeu passionnant LuckyJet. Profitez d'un avantage stratégique en recevant des prédictions qui maximisent vos chances de succès. \n" +
                        "📊 Statistiques en temps réel : " +
                        "Accédez aux statistiques les plus récentes du jeu LuckyJet, analysez les tendances passées et anticipez les futurs mouvements. Notre bot vous fournit des informations utiles pour prendre des décisions éclairées et optimiser votre stratégie de jeu. \n" +
                        "🤖 Interface conviviale : " +
                        "Naviguez facilement à travers notre interface conviviale, conçue pour rendre votre expérience de prédiction aussi agréable que possible. Recevez des prédictions instantanées, consultez les statistiques et suivez votre progression, le tout avec la simplicité de Telegram. \n" +
                        "💬 Communauté active : " +
                        "Rejoignez une communauté passionnée de joueurs avides de LuckyJet. Partagez des conseils, discutez des dernières prédictions et célébrez vos victoires ensemble. Notre bot favorise l'esprit d'équipe pour que chaque membre puisse tirer le meilleur parti de cette expérience de jeu unique. \n" +
                        "🔐 Sécurité avant tout : \n" +
                        "Votre confidentialité et la sécurité de vos données sont notre priorité. Profitez de nos prédictions en toute tranquillité d'esprit, sachant que vos informations sont entre de bonnes mains. \n" +
                        "🚀 Embarquez pour une aventure passionnante avec LuckyJet Predictions Bot dès maintenant et transformez chaque tour en une opportunité de gagner gros! 🚀 \n" +
                        "👉 @ExpressFlowBot \n" +
                        "👉 Inscrivé vous avec le code promo : CHARL567 \n" +
                        "#ExpressFlowBot #Prédictions #TelegramBot #GamingLuck 🎰💰 \n" +
                        "NB: Le bot est encore en dévéloppement. N'hésitez pas à partager vos idées et suggestions. Merci beaucoup! 🔴 \n",
                        {
                            reply_markup: {
                                keyboard: [
                                    ['Lucky Jet Prédiction (Signal ⚡️🚀)'],
                                ],
                                resize_keyboard: true,
                                one_time_keyboard: true,
                            },
                        });
                }
                else {
                    if (messageText.includes('/start')) {

                    }
                    else {
                        ctx.reply('Je ne comprends pas votre message.');
                    }
                }
            }

        }
    });


});


// Gérer les callbacks des boutons
bot.action('win', (ctx) => {

    db.run('UPDATE stats SET win = win + 1', (err) => {
        if (err) {
            console.error('Erreur lors de l\'incrémentation de "win" :', err);
        } else {
            ctx.reply('🟢 Félicitations! 🎉');
        }
    });
    ctx.editMessageReplyMarkup({
        inline_keyboard: [
            // Vous pouvez ajouter d'autres boutons ici si nécessaire
            // [{ text: 'Nouveau Bouton', callback_data: 'nouveau_bouton' }],
            [],
        ],
    });

});


bot.action('lose', (ctx) => {
    db.run('UPDATE stats SET lose = lose + 1', (err) => {
        if (err) {
            console.error('Erreur lors de l\'incrémentation de "lose" :', err);
        } else {
            ctx.reply('🔴 Dommage! 😞');
        }
    });
    // Supprimer l'action du bouton "perdu"
    ctx.editMessageReplyMarkup({
        inline_keyboard: [
            // Vous pouvez ajouter d'autres boutons ici si nécessaire
            // [{ text: 'Nouveau Bouton', callback_data: 'nouveau_bouton' }],
            [],
        ],
    });
});


bot.action('start', (ctx) => {
    ctx.reply('/start');
});
// Démarrer le bot
bot.launch();

-- MySQL dump generated from db/data.json
SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `scan_events`;
CREATE TABLE `scan_events` (
  `id` VARCHAR(64) PRIMARY KEY,
  `exhibit_id` VARCHAR(64) NOT NULL,
  `source` VARCHAR(64),
  `at` DATETIME(3)
);

DROP TABLE IF EXISTS `ratings`;
CREATE TABLE `ratings` (
  `id` VARCHAR(64) PRIMARY KEY,
  `visitor_id` VARCHAR(128),
  `exhibit_id` VARCHAR(64),
  `rating` INT,
  `comment` TEXT,
  `created_at` DATETIME(3),
  `updated_at` DATETIME(3)
);

DROP TABLE IF EXISTS `favorites`;
CREATE TABLE `favorites` (
  `visitor_id` VARCHAR(128) NOT NULL,
  `exhibit_id` VARCHAR(64) NOT NULL,
  `created_at` DATETIME(3),
  PRIMARY KEY (`visitor_id`, `exhibit_id`)
);

DROP TABLE IF EXISTS `exhibits`;
CREATE TABLE `exhibits` (
  `id` VARCHAR(64) PRIMARY KEY,
  `code` VARCHAR(64),
  `title` VARCHAR(255),
  `category` VARCHAR(128),
  `origin` VARCHAR(255),
  `year` VARCHAR(64),
  `location` VARCHAR(255),
  `image_path` TEXT,
  `description` TEXT,
  `description_tl` TEXT,
  `description_cb` TEXT,
  `created_at` DATETIME(3),
  `updated_at` DATETIME(3)
);

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` VARCHAR(64) PRIMARY KEY,
  `username` VARCHAR(128) UNIQUE,
  `password_hash` VARCHAR(255),
  `role` VARCHAR(64),
  `created_at` DATETIME(3)
);

-- exhibits
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('8J8l15t-1H','EX-001','Under the Sea','Marine & Nature','Museum\'s main exhibit','Permanent exhibit','Main Exhibit Hall','https://museosangbata.org/wp-content/uploads/2014/11/under-the-sea-banner-260x170.jpg','The museum\'s flagship exhibit on the marine environment — how sand forms, how coral reefs grow and the threats facing them, marine mammals, and the role mangroves play along the coast.','Pangunahing eksibit ng museo tungkol sa karagatan — kung paano nabubuo ang buhangin, paano lumalaki ang mga coral reef at ang mga banta sa mga ito, mga yamang-dagat at ang papel ng mga bakawan sa baybayin.','Pangunang eksibit sa museyo bahin sa dagat — giunsa paghulma ang balas, giunsa pagtubo ang coral reef ug ang mga hulga nga ilang giatubang, mga dagatnong mamalya, ug ang papel sa mangrove sa baybayon.','2026-07-24 07:09:34.703','2026-07-24 07:09:34.703');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('eHOuUiCTyI','EX-002','The River','Marine & Nature','Marine Conservation Education Program','Permanent exhibit','Main Exhibit Hall','','One of the museum\'s eight permanent exhibits, following freshwater systems on their way toward the sea — part of the museum\'s broader effort to build appreciation for Negros\' marine and coastal environment.','Isa sa walong permanenteng eksibit ng museo, sumusubaybay sa mga sistema ng tubig-tabang patungong dagat — bahagi ng mas malawak na pagsisikap ng museo na palaganapin ang pagpapahalaga sa dagat at baybayin ng Negros.','Usa sa walo ka permanenteng eksibit sa museyo, nagasunod sa freshwater systems padulong sa dagat — bahin sa mas lapad nga paningkamot sa museyo sa pagpahalaga sa dagat ug baybayon sa Negros.','2026-07-24 07:09:34.703','2026-07-24 07:09:34.703');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('kvsizqpXcT','EX-003','Splash Zone (Touch Pool)','Touch & Play','Live touch-pool exhibit','Permanent exhibit','Splash Zone','https://museosangbata.org/wp-content/uploads/2014/11/splash-banner-260x170.jpg','A hands-on touch pool where visitors can see and gently handle seashore creatures — sea stars, sea cucumbers, snails, and small fish — a favorite stop for kids and adults alike.','Isang hands-on na touch pool kung saan makikita at maaring maramdam nang maingat ang mga nilalang sa tabing-dagat — sea stars, sea cucumbers, mga suso, at maliliit na isda — paboritong lugar ng mga bata at matatanda.','Usa ka hands-on touch pool diin makakita ug mahimong hinay-hinay hikapon ang mga hayop sa baybayon — sea stars, sea cucumbers, mga suso, ug gagmay nga isda — paboritong hunonganan sa mga bata ug hamtong.','2026-07-24 07:09:34.703','2026-07-24 07:09:34.703');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('4Kgu3oMucu','EX-004','Everyday Heroes','Character & Heritage','Character education exhibit','Permanent exhibit','Character Gallery','https://museosangbata.org/wp-content/uploads/2014/11/everyday-heroes-banner-260x170.jpg','Profiles of ordinary people who quietly live out values like hard work, thrift, generosity, fairness, forgiveness and courage — encouraging visitors to see everyday character as its own kind of heroism.','Mga paglalarawan ng ordinaryong tao na tahimik na isinasabuhay ang mga pagpapahalaga tulad ng sipag, pagtipid, kabutihang-loob, katarungan, pagpapatawad at tapang — hinihikayat ang mga bisita na makita ang araw-araw na pagkatao bilang isang uri ng kabayanihan.','Profil sa ordinaryong mga tawo nga hinay-hinay nagpuyo sa mga bili sama sa kugi, pagtipig, pagkamaayo, pagkatarong, pagpasaylo ug kaisog — nag-awhag sa mga bisita nga tan-awon ang matag-adlaw nga pagkatawo isip laing matang sa pagka-hero.','2026-07-24 07:09:34.703','2026-07-24 07:09:34.703');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('R61RQcd-Ag','EX-005','Joseph G. Marañon Memorabilia','Character & Heritage','Dedicated to the late Gov. Joseph G. Marañon','Permanent exhibit','Memorial Gallery','https://museosangbata.org/wp-content/uploads/2014/09/jgm-banner-260x170.jpg','A memorial exhibit honoring the late Negros Occidental Governor Joseph G. Marañon, preserving memorabilia connected to his life and public service.','Isang memorial na eksibit para parangalan ang yumaong Gobernador ng Negros Occidental na si Joseph G. Marañon, na pinangangalagaan ang mga memorabilia na konektado sa kanyang buhay at pampublikong paglilingkod.','Usa ka memorial exhibit nga nagpasidungog sa mihimong Gobernador sa Negros Occidental nga si Joseph G. Marañon, nagtipig sa mga memorabilia nga may kalabotan sa iyang kinabuhi ug serbisyo publiko.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('FNV2fFLZMU','EX-006','Hampanganan (Toy Room)','Toys & Collections','Mara Montelibano folk toy collection','Permanent exhibit','Toy Room','https://museosangbata.org/wp-content/uploads/2014/09/hampanganan-banner-260x170.jpg','A folk toy collection spanning more than 50 countries, gathered by Ms. Mara Montelibano, alongside donated McDonald\'s promotional toys and a Beanie Babies collection.','Isang koleksyon ng mga katutubong laruan mula sa mahigit 50 bansa, na pinag-isa ni Ms. Mara Montelibano, kasama ang mga donasyong promotional na laruan ng McDonald\'s at isang koleksyon ng Beanie Babies.','Usa ka koleksyon sa folk toys nga gikan sa kapin 50 ka nasud, gitigum ni Ms. Mara Montelibano, kauban ang gimdonar nga mga promotional toys sa McDonald\'s ug koleksyon sa Beanie Babies.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('ZowcFn9Udh','EX-007','Biodiversity','Marine & Nature','Marine Conservation Education Program','Permanent exhibit','Main Exhibit Hall','','One of the museum\'s eight permanent exhibits, introducing the range of plant and animal life found across Negros\' marine and coastal habitats.','Isa sa walong permanenteng eksibit ng museo, ipinapakilala ang hanay ng mga halaman at hayop na matatagpuan sa iba\'t ibang marine at baybaying tirahan ng Negros.','Usa sa walo ka permanenteng eksibit sa museyo, nagpakita sa lain-laing klase sa tanom ug hayop nga makita sa dagat ug baybayon sa Negros.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('kTe0pYLkzk','EX-008','Story of Plastic','Environmental','Companion piece to the "Floating Witches" art installation','Since 2019','Environmental Gallery','https://museosangbata.org/wp-content/uploads/2019/01/image2-1-e1548236083574-260x170.jpeg','An exhibit raising awareness about plastic waste and its impact on marine life around Negros and Sagay, created alongside the museum\'s \'Floating Witches\' installation made from discarded fishing nets.','Isang eksibit na nagpapataas ng kamalayan tungkol sa plastic waste at ang epekto nito sa buhay-dagat sa paligid ng Negros at Sagay, nilikha kasabay ng \'Floating Witches\' na gawa sa itinamang lambat ng pangingisda.','Usa ka exhibit nga nagpalambo sa kahibalo bahin sa plastic waste ug ang epekto niini sa dagatnong kinabuhi sa palibot sa Negros ug Sagay, gihimo kauban ang \'Floating Witches\' nga gihimo gikan sa gipanglabay nga fishing nets.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('BE29m8zPmZ','EX-009','Carnival (Discovery Room)','Touch & Play','The museum\'s discovery room','Since 2019','Discovery Room','https://museosangbata.org/wp-content/uploads/2019/01/image2-e1548236620227-260x170.jpeg','A playful discovery room built around the idea that play is learning — supporting children\'s healthy development through open-ended, hands-on activity.','Isang masayang discovery room na nakabatay sa ideya na ang paglalaro ay pagkatuto — sinusuportahan ang malusog na pag-unlad ng mga bata sa pamamagitan ng bukas at hands-on na aktibidad.','Usa ka playful discovery room nga gibase sa ideya nga ang pagdula usa ka pamaagi sa pagkat-on — nagsuporta sa himsog nga paglambo sa mga bata pinaagi sa open-ended, hands-on activities.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('L8FAkDqEAr','EX-010','Franco\'s Reading Corner','Reading & Learning','Opened March 28, 2019','Since 2019','Reading Corner','https://museosangbata.org/wp-content/uploads/2019/04/IMG_9526-260x170.jpg','A dedicated children\'s reading nook, blessed and opened to the public in March 2019 to encourage a love of books alongside the museum\'s hands-on exhibits.','Isang espesyal na reading nook para sa mga bata, na pinasinayaan noong Marso 2019 upang himukin ang pagmamahal sa mga libro kasabay ng mga hands-on na eksibit ng museo.','Usa ka dedikadong reading nook para sa mga bata, gibanhigan ug gibuksan sa publiko niadtong Marso 2019 aron dasigon ang paghigugma sa mga libro kauban sa hands-on exhibits sa museyo.','2026-07-24 07:09:34.704','2026-07-24 07:09:34.704');
INSERT INTO `exhibits` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES ('elWEKuJBSJ','EX-011','Mangrove Walk (Outdoor Exhibit)','Marine & Nature','Outdoor extension of the indoor mangrove exhibit','Permanent exhibit','Outdoor — behind the main building','https://museosangbata.org/wp-content/uploads/2014/11/mangrove-walk-banner-260x170.jpg','A small mangrove park and walkway behind the museum showcasing different mangrove species up close, used alongside the museum\'s mangrove seminars and indoor exhibit.','Isang maliit na parke ng bakawan at lakaran sa likod ng museo na nagpapakita ng iba\'t ibang species ng bakawan nang malapitan, ginagamit kasama ng mga seminar ng museo tungkol sa bakawan at indoor exhibit.','Usa ka gamay nga mangrove park ug walkway sa likod sa museyo nga nagpakita sa lain-laing species sa mangrove duol, gigamit kauban ang mangrove seminars sa museyo ug indoor exhibit.','2026-07-24 07:09:34.705','2026-07-24 07:09:34.705');

-- users
INSERT INTO `users` (id,username,password_hash,role,created_at) VALUES ('ODHOLdpu5Y','admin','$2b$10$PSUoUfLUXQ5jDqTV0TxRDOH3D6TLH08f.QaqAOnNcQV2Nj3eNU7.m','admin','2026-07-24 07:09:34.699');

-- ratings
INSERT INTO `ratings` (id,visitor_id,exhibit_id,rating,comment,created_at,updated_at) VALUES ('OBEAXCj2sV','v-mrycach9-8ezrwffy','kvsizqpXcT',5,'niceeeee','2026-07-27 02:33:08.504','2026-07-27 02:33:08.504');

-- scan_events
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('j5wNOmaSXa','8J8l15t-1H','view','2026-07-24 07:20:10.123');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('fGPT6gC1-F','elWEKuJBSJ','view','2026-07-24 07:21:25.547');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('2-lkwusGIg','R61RQcd-Ag','view','2026-07-24 07:22:03.652');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('yJxqH9V8GF','8J8l15t-1H','view','2026-07-24 07:22:38.147');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('FUC6jbzIvG','eHOuUiCTyI','view','2026-07-24 07:26:48.286');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('QPGvPsJPJX','R61RQcd-Ag','view','2026-07-24 07:27:20.126');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('jwtlTYlHHj','8J8l15t-1H','view','2026-07-24 07:27:52.150');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('Kh5Y2RlHT3','elWEKuJBSJ','view','2026-07-24 07:28:35.229');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('s3uquxTNDO','eHOuUiCTyI','view','2026-07-24 07:30:25.749');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('lwqupPypTV','QPtfzv0ViD','view','2026-07-24 07:32:27.088');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('zuJ8uATtWy','elWEKuJBSJ','view','2026-07-24 07:33:06.228');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('vPFY_fMBRj','8J8l15t-1H','view','2026-07-24 07:35:30.328');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('X3kUNpFMls','8J8l15t-1H','view','2026-07-24 07:38:19.233');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('fZKL1LGg4r','elWEKuJBSJ','view','2026-07-24 07:40:13.073');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('xHzXO-7OcS','8J8l15t-1H','view','2026-07-24 07:46:50.360');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('iHPrJj9ltm','8J8l15t-1H','view','2026-07-24 07:48:04.523');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('UVS7sLyJok','8J8l15t-1H','view','2026-07-24 07:49:46.699');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('I8cCsH5b_-','eHOuUiCTyI','view','2026-07-24 07:50:13.253');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('GC5n5tF9PZ','kvsizqpXcT','view','2026-07-24 07:50:19.875');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('THNWsFZUqM','8J8l15t-1H','view','2026-07-24 07:53:36.536');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('HF4nd8puE4','8J8l15t-1H','view','2026-07-24 10:43:30.252');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('CpTDh-Vhfh','ZowcFn9Udh','view','2026-07-24 11:25:40.793');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('PUIpgCPYUV','8J8l15t-1H','view','2026-07-24 12:01:46.930');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('eTLMye0PFt','8J8l15t-1H','view','2026-07-26 09:50:39.842');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('FHimyCUbbF','8J8l15t-1H','view','2026-07-26 10:02:17.049');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('bOtroAwKfB','8J8l15t-1H','view','2026-07-26 10:18:45.042');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('jZs59zPiz-','8J8l15t-1H','view','2026-07-26 10:20:07.409');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('r3bHNaZugw','8J8l15t-1H','view','2026-07-26 10:21:39.462');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('TSkX9f7QpI','8J8l15t-1H','view','2026-07-26 10:22:53.714');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('Ku9rXdxwmh','8J8l15t-1H','view','2026-07-26 10:25:01.790');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('AB8FQ7dAiW','8J8l15t-1H','view','2026-07-26 13:12:20.815');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('_AtAY3VWFB','elWEKuJBSJ','view','2026-07-26 13:51:03.457');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('IM-CnLcv7I','8J8l15t-1H','view','2026-07-26 13:53:37.963');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('4f-pdYurR9','8J8l15t-1H','view','2026-07-26 13:55:30.612');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('NVV2qa-wFp','R61RQcd-Ag','view','2026-07-26 13:57:50.696');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('X_5uIY4xq_','8J8l15t-1H','view','2026-07-26 14:05:16.830');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('SGNZOIKoUm','8J8l15t-1H','view','2026-07-26 14:22:51.250');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('YCp01H-w3a','BE29m8zPmZ','view','2026-07-26 14:27:16.754');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('7Ypnj9GLmP','elWEKuJBSJ','view','2026-07-26 14:29:24.625');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('tQc48unO_N','8J8l15t-1H','view','2026-07-26 14:42:05.096');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('zVllCoe_Ia','8J8l15t-1H','view','2026-07-27 02:31:57.173');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('s3wBfHt7GD','kvsizqpXcT','view','2026-07-27 02:32:59.697');
INSERT INTO `scan_events` (id,exhibit_id,source,at) VALUES ('aztkwm5Fle','8J8l15t-1H','view','2026-07-27 02:44:02.669');

SET FOREIGN_KEY_CHECKS=1;

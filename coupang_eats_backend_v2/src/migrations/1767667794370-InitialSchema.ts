import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1767667794370 implements MigrationInterface {
    name = 'InitialSchema1767667794370'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE \`category\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`cover_img\` varchar(255) NULL, \`slug\` varchar(255) NOT NULL, UNIQUE INDEX \`IDX_23c05c292c439d77b0de816b50\` (\`name\`), UNIQUE INDEX \`IDX_cb73208f151aa71cdd78f662d7\` (\`slug\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`dish\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`price\` int NOT NULL, \`photo\` varchar(255) NULL, \`description\` varchar(255) NOT NULL, \`options\` json NULL, \`restaurant_id\` varchar(255) NOT NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`restaurant\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`cover_img\` varchar(255) NOT NULL, \`address\` varchar(255) NOT NULL, \`delivery_fee\` int NOT NULL, \`minimum_price\` int NOT NULL, \`is_promoted\` tinyint NOT NULL DEFAULT 0, \`promoted_until\` timestamp NULL, \`owner_id\` varchar(255) NOT NULL, \`category_id\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`order_item\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`dish_name\` varchar(255) NULL, \`options\` json NULL, \`order_id\` varchar(255) NULL, \`dish_id\` varchar(36) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`order\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`total\` int NULL, \`totalCount\` int NULL, \`status\` enum ('Pending', 'Cooking', 'Cooked', 'PickedUp', 'Delivered') NOT NULL DEFAULT 'Pending', \`customer_id\` varchar(255) NULL, \`driver_id\` varchar(255) NULL, \`restaurant_id\` varchar(255) NULL, PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`user\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`email\` varchar(255) NOT NULL, \`password\` varchar(255) NOT NULL, \`name\` varchar(255) NOT NULL, \`role\` enum ('Client', 'Owner', 'Delivery') NOT NULL, \`verified\` tinyint NOT NULL DEFAULT 0, UNIQUE INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` (\`email\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`reviews\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`score\` int NOT NULL, \`review_text\` varchar(255) NOT NULL, \`review_img\` json NULL, \`client_id\` varchar(255) NULL, \`restaurant_id\` varchar(255) NULL, \`order_id\` varchar(255) NULL, UNIQUE INDEX \`REL_e4b0ed40bdd0f318108612c285\` (\`order_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`CREATE TABLE \`payment\` (\`created_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), \`updated_at\` timestamp(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), \`deleted_at\` timestamp(6) NULL, \`id\` varchar(255) NOT NULL, \`transaction_id\` varchar(255) NOT NULL, \`user_id\` varchar(255) NOT NULL, \`restaurant_id\` varchar(255) NOT NULL, \`order_id\` varchar(255) NOT NULL, UNIQUE INDEX \`REL_f5221735ace059250daac9d980\` (\`order_id\`), PRIMARY KEY (\`id\`)) ENGINE=InnoDB`);
        await queryRunner.query(`ALTER TABLE \`dish\` ADD CONSTRAINT \`FK_54a6dff62586657498ee29f83ce\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`restaurant\` ADD CONSTRAINT \`FK_fe7a22ecf454b7168b5a37fbdce\` FOREIGN KEY (\`owner_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`restaurant\` ADD CONSTRAINT \`FK_848ac5e4e3e511560d07e36a257\` FOREIGN KEY (\`category_id\`) REFERENCES \`category\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order_item\` ADD CONSTRAINT \`FK_1c8211d2f1e3a0e3548b1d8af1c\` FOREIGN KEY (\`dish_id\`) REFERENCES \`dish\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order_item\` ADD CONSTRAINT \`FK_e9674a6053adbaa1057848cddfa\` FOREIGN KEY (\`order_id\`) REFERENCES \`order\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order\` ADD CONSTRAINT \`FK_cd7812c96209c5bdd48a6b858b0\` FOREIGN KEY (\`customer_id\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order\` ADD CONSTRAINT \`FK_71e6299877e37f03f2a00527fff\` FOREIGN KEY (\`driver_id\`) REFERENCES \`user\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`order\` ADD CONSTRAINT \`FK_3edfcab660a53a1ac59e0e51911\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_d4e7e923e6bb78a8f0add754493\` FOREIGN KEY (\`client_id\`) REFERENCES \`user\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_2269110d10df8d494b99e1381d2\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`reviews\` ADD CONSTRAINT \`FK_e4b0ed40bdd0f318108612c2851\` FOREIGN KEY (\`order_id\`) REFERENCES \`order\`(\`id\`) ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_c66c60a17b56ec882fcd8ec770b\` FOREIGN KEY (\`user_id\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_ba8f7f44c7d060dc89c5118860c\` FOREIGN KEY (\`restaurant_id\`) REFERENCES \`restaurant\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE \`payment\` ADD CONSTRAINT \`FK_f5221735ace059250daac9d9803\` FOREIGN KEY (\`order_id\`) REFERENCES \`order\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_f5221735ace059250daac9d9803\``);
        await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_ba8f7f44c7d060dc89c5118860c\``);
        await queryRunner.query(`ALTER TABLE \`payment\` DROP FOREIGN KEY \`FK_c66c60a17b56ec882fcd8ec770b\``);
        await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_e4b0ed40bdd0f318108612c2851\``);
        await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_2269110d10df8d494b99e1381d2\``);
        await queryRunner.query(`ALTER TABLE \`reviews\` DROP FOREIGN KEY \`FK_d4e7e923e6bb78a8f0add754493\``);
        await queryRunner.query(`ALTER TABLE \`order\` DROP FOREIGN KEY \`FK_3edfcab660a53a1ac59e0e51911\``);
        await queryRunner.query(`ALTER TABLE \`order\` DROP FOREIGN KEY \`FK_71e6299877e37f03f2a00527fff\``);
        await queryRunner.query(`ALTER TABLE \`order\` DROP FOREIGN KEY \`FK_cd7812c96209c5bdd48a6b858b0\``);
        await queryRunner.query(`ALTER TABLE \`order_item\` DROP FOREIGN KEY \`FK_e9674a6053adbaa1057848cddfa\``);
        await queryRunner.query(`ALTER TABLE \`order_item\` DROP FOREIGN KEY \`FK_1c8211d2f1e3a0e3548b1d8af1c\``);
        await queryRunner.query(`ALTER TABLE \`restaurant\` DROP FOREIGN KEY \`FK_848ac5e4e3e511560d07e36a257\``);
        await queryRunner.query(`ALTER TABLE \`restaurant\` DROP FOREIGN KEY \`FK_fe7a22ecf454b7168b5a37fbdce\``);
        await queryRunner.query(`ALTER TABLE \`dish\` DROP FOREIGN KEY \`FK_54a6dff62586657498ee29f83ce\``);
        await queryRunner.query(`DROP INDEX \`REL_f5221735ace059250daac9d980\` ON \`payment\``);
        await queryRunner.query(`DROP TABLE \`payment\``);
        await queryRunner.query(`DROP INDEX \`REL_e4b0ed40bdd0f318108612c285\` ON \`reviews\``);
        await queryRunner.query(`DROP TABLE \`reviews\``);
        await queryRunner.query(`DROP INDEX \`IDX_e12875dfb3b1d92d7d7c5377e2\` ON \`user\``);
        await queryRunner.query(`DROP TABLE \`user\``);
        await queryRunner.query(`DROP TABLE \`order\``);
        await queryRunner.query(`DROP TABLE \`order_item\``);
        await queryRunner.query(`DROP TABLE \`restaurant\``);
        await queryRunner.query(`DROP TABLE \`dish\``);
        await queryRunner.query(`DROP INDEX \`IDX_cb73208f151aa71cdd78f662d7\` ON \`category\``);
        await queryRunner.query(`DROP INDEX \`IDX_23c05c292c439d77b0de816b50\` ON \`category\``);
        await queryRunner.query(`DROP TABLE \`category\``);
    }

}

import { DataSource } from 'typeorm';

export async function dbCleanup(dataSource: DataSource): Promise<void> {
  if (!dataSource || !dataSource.isInitialized) return;

  try {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0;');
    const entities = dataSource.entityMetadatas;

    for (const entity of entities) {
      const tableName = entity.tableName;
      await dataSource.query(`TRUNCATE TABLE \`${tableName}\`;`);
    }
  } catch (error) {
    console.error('❌ DB Cleanup Error:', error);
    throw error;
  } finally {
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1;');
  }
}

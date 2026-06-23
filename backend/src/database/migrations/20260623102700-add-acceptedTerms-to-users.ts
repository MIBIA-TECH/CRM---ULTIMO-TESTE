import { QueryInterface, DataTypes } from "sequelize";

module.exports = {
  up: async (queryInterface: QueryInterface) => {
    try {
      // Verificar a estrutura atual da tabela Users
      const tableInfo: Record<string, any> = await queryInterface.describeTable("Users");
      
      // Se a coluna acceptedTerms não existir, criá-la
      if (!tableInfo.acceptedTerms) {
        console.log("Criando coluna acceptedTerms na tabela Users");
        await queryInterface.addColumn("Users", "acceptedTerms", {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        });
      } else {
        console.log("Coluna acceptedTerms já existe na tabela Users - pulando");
      }
      
      // Se a coluna acceptedTermsAt não existir, criá-la
      if (!tableInfo.acceptedTermsAt) {
        console.log("Criando coluna acceptedTermsAt na tabela Users");
        await queryInterface.addColumn("Users", "acceptedTermsAt", {
          type: DataTypes.DATE,
          allowNull: true
        });
      } else {
        console.log("Coluna acceptedTermsAt já existe na tabela Users - pulando");
      }
      
      return Promise.resolve();
    } catch (error) {
      console.error("Erro ao verificar/criar colunas de termos na tabela Users:", error);
      return Promise.reject(error);
    }
  },

  down: async (queryInterface: QueryInterface) => {
    try {
      await queryInterface.removeColumn("Users", "acceptedTerms");
      await queryInterface.removeColumn("Users", "acceptedTermsAt");
      return Promise.resolve();
    } catch (error) {
      console.error("Erro ao reverter migração de termos na tabela Users:", error);
      return Promise.reject(error);
    }
  }
};

const express = require("express");
const router = express.Router();
const { Op, fn, col } = require("sequelize");
const {
  Warehouse,
  Inventory,
  Product,
  Supplier,
  ProductSupplier,
  Order,
} = require("../models");
router.get("/api/companies/:company_id/alerts/low-stock", async (req, res) => {
  try {
    const { company_id } = req.params;
    const alerts = [];
    const warehouses = await Warehouse.findAll({
      where: { company_id },
      attributes: ["id", "name"],
    });
    const warehouseIds = warehouses.map((w) => w.id);
    if (warehouseIds.length === 0) {
      return res.status(200).json({ alerts: [], total_alerts: 0 });
    }
    const last30Days = new Date();
    last30Days.setDate(last30Days.getDate() - 30);
    const salesData = await Order.findAll({
      attributes: [
        "product_id",
        "warehouse_id",
        [fn("SUM", col("quantity")), "total_sold"],
      ],
      where: {
        warehouse_id: { [Op.in]: warehouseIds },
        created_at: { [Op.gte]: last30Days },
      },
      group: ["product_id", "warehouse_id"],
      raw: true,
    });
    const salesMap = {};
    salesData.forEach((s) => {
      salesMap[`${s.product_id}_${s.warehouse_id}`] = parseInt(s.total_sold);
    });
    const inventoryRecords = await Inventory.findAll({
      include: [
        {
          model: Product,
          attributes: ["id", "name", "sku", "low_stock_threshold"],
        },
        {
          model: Warehouse,
          attributes: ["id", "name", "company_id"],
          where: { company_id },
        },
      ],
    });
    for (const record of inventoryRecords) {
      const product = record.Product;
      const warehouse = record.Warehouse;
      const currentStock = record.quantity;
      const threshold = product.low_stock_threshold;
      if (threshold === null || threshold === undefined) continue;
      if (currentStock >= threshold) continue
      const key = `${product.id}_${warehouse.id}`;
      const totalSold = salesMap[key] || 0;
      if (totalSold === 0) continue;
      const avgDailySales = totalSold / 30;
      let daysUntilStockout = null;
      if (avgDailySales > 0) {
        daysUntilStockout = Math.floor(currentStock / avgDailySales);
      }
      const supplier = await Supplier.findOne({
        include: [
          {
            model: ProductSupplier,
            where: { product_id: product.id },
          },
        ],
      });
      alerts.push({
        product_id: product.id,
        product_name: product.name,
        sku: product.sku,
        warehouse_id: warehouse.id,
        warehouse_name: warehouse.name,
        current_stock: currentStock,
        threshold: threshold,
        days_until_stockout: daysUntilStockout,
        supplier: supplier
          ? {
              id: supplier.id,
              name: supplier.name,
              contact_email: supplier.contact_email,
            }
          : null,
      });
    }
    return res.status(200).json({
      alerts,
      total_alerts: alerts.length,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      error: "Internal Server Error",
    });
  }
});
module.exports = router;

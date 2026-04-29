@app.route('/api/products', methods=['POST'])
def create_product():
    data = request.json
    try:
         # Validate required fields
          required_fields = ['name', 'sku', 'price']
          for field in required_fields:
          if field not in data:
           return jsonify({"error": f"{field} is required"}), 400
           # Validate price format
            try:
            price = Decimal(data['price'])
            except:
            return jsonify({"error": "Invalid price format"}), 400
          #Ensure SKU uniqueness
           existing_product = Product.query.filter_by(sku=data['sku']).first()
           if existing_product:
           return jsonify({"error": "SKU already exists"}), 400
          # Create product (decoupled from warehouse)
          product = Product(
          name=data['name'],
          sku=data['sku'],
          price=price
          )
         db.session.add(product)
         db.session.flush() # get product.id before commit
         # Optional inventory creation
         if 'warehouse_id' in data:
         warehouse = Warehouse.query.get(data['warehouse_id'])
         if not warehouse:
         return jsonify({"error": "Invalid warehouse_id"}), 400
         inventory = Inventory(
         product_id=product.id,
         warehouse_id=data['warehouse_id'],
         quantity=data.get('initial_quantity', 0)
          )
        db.session.add(inventory)
        #Single atomic transaction
        db.session.commit()
        return jsonify({
        "message": "Product created successfully",
        "product_id": product.id
        }), 201
  except IntegrityError:
  db.session.rollback()
  return jsonify({"error": "Database integrity error"}), 400
  except Exception as e:
  db.session.rollback()
  return jsonify({"error": str(e)}), 500

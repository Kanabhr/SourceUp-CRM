import { Vendor, VENDOR_CATEGORIES, VENDOR_COUNTRIES, VENDOR_STATUSES } from "../MongoDB/Models/Vendor.schema.js";
import { AuditLog } from "../MongoDB/Models/AuditLog.schema.js";

/**
 * POST /api/v1/vendors
 * Create a new vendor.
 */
export const createVendor = async (req, res) => {
  try {
    const {
      companyName,
      contactPerson,
      phone,
      email,
      country,
      city,
      factoryAddress,
      category,
      products,
      paymentTerms,
      bankDetails,
      rating,
      remarks,
      status,
    } = req.body;

    if (!companyName || !companyName.trim()) {
      return res.status(400).json({ success: false, message: "Company name is required" });
    }

    const vendor = new Vendor({
      companyName: companyName.trim(),
      contactPerson: contactPerson?.trim() || "",
      phone: phone?.trim() || "",
      email: email?.trim().toLowerCase() || "",
      country: VENDOR_COUNTRIES.includes(country) ? country : "India",
      city: city?.trim() || "",
      factoryAddress: factoryAddress?.trim() || "",
      category: VENDOR_CATEGORIES.includes(category) ? category : "Other",
      products: Array.isArray(products)
        ? products.map(p => String(p).trim()).filter(Boolean)
        : (products ? String(products).split(",").map(p => p.trim()).filter(Boolean) : []),
      paymentTerms: paymentTerms?.trim() || "",
      bankDetails: {
        beneficiaryName: bankDetails?.beneficiaryName?.trim() || "",
        bankName:        bankDetails?.bankName?.trim() || "",
        accountNo:       bankDetails?.accountNo?.trim() || "",
        ifscOrSwift:     bankDetails?.ifscOrSwift?.trim() || "",
        branch:          bankDetails?.branch?.trim() || "",
      },
      rating: rating != null ? Math.min(5, Math.max(1, Number(rating) || 3)) : 3,
      remarks: remarks?.trim() || "",
      status: VENDOR_STATUSES.includes(status) ? status : "Active",
      createdBy: req.user._id,
    });

    await vendor.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "CREATE_VENDOR",
      entity: "Vendor",
      entityId: vendor._id,
      newValue: { vendorId: vendor.vendorId, companyName: vendor.companyName },
    });

    return res.status(201).json({
      success: true,
      message: "Vendor created successfully",
      data: vendor,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to create vendor",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/vendors
 * Fetch vendors with filtering, search, and pagination.
 */
export const getVendors = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const filter = {};

    if (req.query.country && VENDOR_COUNTRIES.includes(req.query.country)) {
      filter.country = req.query.country;
    }
    if (req.query.category && VENDOR_CATEGORIES.includes(req.query.category)) {
      filter.category = req.query.category;
    }
    if (req.query.status && VENDOR_STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }
    if (req.query.rating) {
      filter.rating = { $gte: Number(req.query.rating) };
    }

    if (req.query.search) {
      const q = req.query.search.trim();
      filter.$or = [
        { vendorId: { $regex: q, $options: "i" } },
        { companyName: { $regex: q, $options: "i" } },
        { contactPerson: { $regex: q, $options: "i" } },
        { city: { $regex: q, $options: "i" } },
        { products: { $regex: q, $options: "i" } },
      ];
    }

    const [vendors, total] = await Promise.all([
      Vendor.find(filter)
        .populate("createdBy", "username")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Vendor.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        vendors,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendors",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/vendors/search
 * Lightweight autocomplete/dropdown list for creating POs.
 */
export const searchVendors = async (req, res) => {
  try {
    const query = req.query.q?.trim() || "";
    const filter = { status: "Active" };

    if (query) {
      filter.$or = [
        { companyName: { $regex: query, $options: "i" } },
        { vendorId: { $regex: query, $options: "i" } },
        { contactPerson: { $regex: query, $options: "i" } },
      ];
    }

    const vendors = await Vendor.find(filter)
      .select("vendorId companyName contactPerson phone country category paymentTerms")
      .sort({ companyName: 1 })
      .limit(30)
      .lean();

    return res.status(200).json({
      success: true,
      data: vendors,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to search vendors",
      error: err.message,
    });
  }
};

/**
 * GET /api/v1/vendors/:id
 * Retrieve a single vendor by ID.
 */
export const getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
      .populate("createdBy", "username");

    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    return res.status(200).json({
      success: true,
      data: vendor,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch vendor",
      error: err.message,
    });
  }
};

/**
 * PATCH /api/v1/vendors/:id
 * Update an existing vendor.
 */
export const updateVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    const oldData = vendor.toObject();

    const {
      companyName,
      contactPerson,
      phone,
      email,
      country,
      city,
      factoryAddress,
      category,
      products,
      paymentTerms,
      bankDetails,
      rating,
      remarks,
      status,
    } = req.body;

    if (companyName !== undefined) vendor.companyName = companyName.trim();
    if (contactPerson !== undefined) vendor.contactPerson = contactPerson.trim();
    if (phone !== undefined) vendor.phone = phone.trim();
    if (email !== undefined) vendor.email = email.trim().toLowerCase();
    if (country && VENDOR_COUNTRIES.includes(country)) vendor.country = country;
    if (city !== undefined) vendor.city = city.trim();
    if (factoryAddress !== undefined) vendor.factoryAddress = factoryAddress.trim();
    if (category && VENDOR_CATEGORIES.includes(category)) vendor.category = category;
    if (products !== undefined) {
      vendor.products = Array.isArray(products)
        ? products.map(p => String(p).trim()).filter(Boolean)
        : String(products).split(",").map(p => p.trim()).filter(Boolean);
    }
    if (paymentTerms !== undefined) vendor.paymentTerms = paymentTerms.trim();
    if (bankDetails) {
      if (bankDetails.beneficiaryName !== undefined) vendor.bankDetails.beneficiaryName = bankDetails.beneficiaryName.trim();
      if (bankDetails.bankName !== undefined) vendor.bankDetails.bankName = bankDetails.bankName.trim();
      if (bankDetails.accountNo !== undefined) vendor.bankDetails.accountNo = bankDetails.accountNo.trim();
      if (bankDetails.ifscOrSwift !== undefined) vendor.bankDetails.ifscOrSwift = bankDetails.ifscOrSwift.trim();
      if (bankDetails.branch !== undefined) vendor.bankDetails.branch = bankDetails.branch.trim();
    }
    if (rating !== undefined) vendor.rating = Math.min(5, Math.max(1, Number(rating) || 3));
    if (remarks !== undefined) vendor.remarks = remarks.trim();
    if (status && VENDOR_STATUSES.includes(status)) vendor.status = status;

    await vendor.save();

    await AuditLog.create({
      userId: req.user._id,
      action: "UPDATE_VENDOR",
      entity: "Vendor",
      entityId: vendor._id,
      oldValue: oldData,
      newValue: vendor.toObject(),
    });

    return res.status(200).json({
      success: true,
      message: "Vendor updated successfully",
      data: vendor,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update vendor",
      error: err.message,
    });
  }
};

/**
 * DELETE /api/v1/vendors/:id
 * Delete a vendor (Superadmin only).
 */
export const deleteVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findByIdAndDelete(req.params.id);
    if (!vendor) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    await AuditLog.create({
      userId: req.user._id,
      action: "DELETE_VENDOR",
      entity: "Vendor",
      entityId: vendor._id,
      oldValue: { vendorId: vendor.vendorId, companyName: vendor.companyName },
    });

    return res.status(200).json({
      success: true,
      message: "Vendor deleted successfully",
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete vendor",
      error: err.message,
    });
  }
};

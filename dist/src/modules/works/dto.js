"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfflineWorkDto = exports.SetCreatorPriceDto = exports.SetCreatorDiscountDto = exports.UpdateWorkDiscountDto = exports.UpdateWorkWeightDto = exports.ReviewDecisionDto = exports.UpsertWorkDto = void 0;
const class_validator_1 = require("class-validator");
class UpsertWorkDto {
}
exports.UpsertWorkDto = UpsertWorkDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertWorkDto.prototype, "id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(120),
    __metadata("design:type", String)
], UpsertWorkDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertWorkDto.prototype, "desc", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(99999999),
    __metadata("design:type", Number)
], UpsertWorkDto.prototype, "price", void 0);
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(999),
    __metadata("design:type", Number)
], UpsertWorkDto.prototype, "stock", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertWorkDto.prototype, "categoryId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpsertWorkDto.prototype, "subCategoryId", void 0);
__decorate([
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpsertWorkDto.prototype, "support7days", void 0);
__decorate([
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], UpsertWorkDto.prototype, "images", void 0);
class ReviewDecisionDto {
}
exports.ReviewDecisionDto = ReviewDecisionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewDecisionDto.prototype, "workId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ReviewDecisionDto.prototype, "reason", void 0);
class UpdateWorkWeightDto {
}
exports.UpdateWorkWeightDto = UpdateWorkWeightDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateWorkWeightDto.prototype, "weight", void 0);
class UpdateWorkDiscountDto {
}
exports.UpdateWorkDiscountDto = UpdateWorkDiscountDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Object)
], UpdateWorkDiscountDto.prototype, "discountPrice", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateWorkDiscountDto.prototype, "discountStartAt", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", Object)
], UpdateWorkDiscountDto.prototype, "discountEndAt", void 0);
class SetCreatorDiscountDto {
}
exports.SetCreatorDiscountDto = SetCreatorDiscountDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], SetCreatorDiscountDto.prototype, "discountPercent", void 0);
class SetCreatorPriceDto {
}
exports.SetCreatorPriceDto = SetCreatorPriceDto;
__decorate([
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(99999999),
    __metadata("design:type", Number)
], SetCreatorPriceDto.prototype, "price", void 0);
class OfflineWorkDto {
}
exports.OfflineWorkDto = OfflineWorkDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], OfflineWorkDto.prototype, "reason", void 0);
//# sourceMappingURL=dto.js.map
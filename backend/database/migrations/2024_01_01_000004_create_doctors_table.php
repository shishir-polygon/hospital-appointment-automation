<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('department_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('title')->default('Dr.');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->text('qualifications')->nullable();
            $table->text('specializations')->nullable();
            $table->text('bio')->nullable();
            $table->string('photo')->nullable();
            $table->decimal('consultation_fee', 10, 2)->default(0);
            $table->integer('avg_consultation_minutes')->default(15);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();

            $table->index(['hospital_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('doctors');
    }
};
